// Построитель -filter_complex из DAG-графа. Топо-обход: для каждой ноды вычисляем
// её выходные лейблы видео/аудио потоков и накапливаем фрагменты filter_complex.
// Обычный фильтр оборачивается в лейблы ([prev]scale=...[v1]); merge-операция строит
// фрагмент сама через MergeSpec.toComplex. См. complex/types.ts, dag.ts, docs/ARCHITECTURE.md.
import type { Graph, GraphNode } from "../../../types/graph";
import { getFilterDef } from "../catalog";
import { topoSort, incomingEdges, outgoingEdges, outputNodes } from "../dag";
import type { ComplexResult, MultiOutputResult, OutputPlan, StreamLabel } from "./types";
import { makeLabeler, inputLabel, bracket, splitFragment } from "./labels";

// Лейблы потоков НА ВЫХОДЕ ноды: что отдаёт нода дальше по графу.
// null означает «потока нет» (напр. видео после извлечения аудио).
interface NodeStreams {
  v: StreamLabel | null;
  a: StreamLabel | null;
}

// inputPaths — пути входных файлов, упорядоченные по id input-нод в порядке topoSort.
// Маппинг inputNodeId → индекс файла строится здесь же (индекс = позиция в -i).
export function buildComplexPlan(graph: Graph, inputPaths: Map<string, string>): ComplexResult {
  const ordered = topoSort(graph);
  if (ordered === null) {
    return { error: "Соедини ноды: вход → фильтры → выход" };
  }

  const labeler = makeLabeler();
  const streams = new Map<string, NodeStreams>(); // выходные лейблы каждой ноды
  const fragments: string[] = []; // куски filter_complex (через ';')
  const outputArgs: string[] = [];
  const inputs: string[] = []; // пути в порядке -i
  const inputIndex = new Map<string, number>(); // inputNodeId → N

  for (const node of ordered) {
    if (node.kind === "input") {
      // Каждый вход получает свой индекс файла и стартовые лейблы N:v / N:a
      const idx = inputs.length;
      inputIndex.set(node.id, idx);
      const path = inputPaths.get(node.id);
      if (!path) return { error: "Вход без выбранного файла", invalidNodeIds: [node.id] };
      inputs.push(path);
      streams.set(node.id, { v: inputLabel(idx, "v"), a: inputLabel(idx, "a") });
      continue;
    }

    if (node.kind === "output") {
      // output ничего не строит — его входной поток станет тем, что мапим наружу
      continue;
    }

    // filter-нода
    const result = buildFilterNode(graph, node, streams, labeler, fragments, outputArgs);
    if ("error" in result) return result;
  }

  // Что мапить наружу — берём потоки предшественника output-ноды
  const output = ordered.find((n) => n.kind === "output")!;
  const into = predecessorStreams(graph, output.id, streams);
  if (!into) return { error: "Цепочка не доходит до выхода" };

  return {
    inputs,
    filterComplex: fragments.join(";"),
    mapVideo: into.v,
    mapAudio: into.a,
    outputArgs,
  };
}

// Обработать одну filter-ноду: вычислить входные лейблы от предшественников,
// собрать фрагмент filter_complex, записать выходные лейблы ноды.
function buildFilterNode(
  graph: Graph,
  node: GraphNode,
  streams: Map<string, NodeStreams>,
  labeler: ReturnType<typeof makeLabeler>,
  fragments: string[],
  outputArgs: string[],
): NodeStreams | { error: string; invalidNodeIds?: string[] } {
  const def = node.filterId ? getFilterDef(node.filterId) : undefined;
  if (!def) return { error: `Неизвестный фильтр: ${node.filterId}`, invalidNodeIds: [node.id] };

  // Входные потоки ноды — от её предшественников, упорядоченные по targetHandle
  const incoming = orderedIncomingStreams(graph, node.id, streams);
  if (incoming === null) {
    return { error: `Не хватает входа для «${def.label}»`, invalidNodeIds: [node.id] };
  }

  if (def.merge) {
    // Merge-операция строит фрагмент сама: даём ей входные лейблы и свежие выходные.
    const vIn = incoming.map((s) => s.v).filter((l): l is string => l !== null);
    const aIn = incoming.map((s) => s.a).filter((l): l is string => l !== null);
    const vOut = labeler.nextVideo();
    const aOut = def.merge.audioInputs ? labeler.nextAudio() : undefined;
    const fragment = def.merge.toComplex({ vIn, aIn, vOut, aOut, params: node.params });
    fragments.push(fragment);
    // outputArgs (кодеки, -f gif и т.п.) merge-операция задаёт через обычный toCommand
    const extra = def.toCommand(node.params).outputArgs;
    if (extra) outputArgs.push(...extra);
    const out: NodeStreams = { v: vOut, a: aOut ?? null };
    streams.set(node.id, out);
    return out;
  }

  // Обычный фильтр в filter_complex: один вход. Видеофильтр оборачиваем в лейблы,
  // аудио и outputArgs берём из toCommand. Аудиопоток проходит «насквозь» (тот же лейбл).
  const prev = incoming[0];
  const contrib = def.toCommand(node.params);
  if (contrib.outputArgs) outputArgs.push(...contrib.outputArgs);

  let vOut = prev.v;
  if (contrib.vf && prev.v) {
    vOut = labeler.nextVideo();
    fragments.push(`${bracket(prev.v)}${contrib.vf}${bracket(vOut)}`);
  }
  // af в filter_complex обернули бы аналогично, но в первой итерации merge-операции
  // сами решают судьбу аудио; обычные af-фильтры в DAG-сценариях пока не комбинируются.
  const out: NodeStreams = { v: vOut, a: prev.a };
  streams.set(node.id, out);
  return out;
}

// Входные потоки ноды, упорядоченные по targetHandle (для merge важен порядок:
// основной вход раньше накладки). Рёбра без targetHandle идут в порядке graph.edges.
// null — если у какого-то входящего ребра нет известных потоков (предшественник не построен).
function orderedIncomingStreams(
  graph: Graph,
  nodeId: string,
  streams: Map<string, NodeStreams>,
): NodeStreams[] | null {
  const incoming = incomingEdges(graph, nodeId);
  if (incoming.length === 0) return null;
  // Стабильная сортировка по targetHandle (undefined → в конец, сохраняя исходный порядок)
  const sorted = [...incoming].sort((a, b) => {
    const ha = a.targetHandle ?? "￿";
    const hb = b.targetHandle ?? "￿";
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  const result: NodeStreams[] = [];
  for (const e of sorted) {
    const s = streams.get(e.source);
    if (!s) return null;
    result.push(s);
  }
  return result;
}

// Потоки, входящие в указанную ноду (её единственного предшественника) — для output.
function predecessorStreams(
  graph: Graph,
  nodeId: string,
  streams: Map<string, NodeStreams>,
): NodeStreams | null {
  const incoming = incomingEdges(graph, nodeId);
  if (incoming.length === 0) return null;
  return streams.get(incoming[0].source) ?? null;
}

// =========================================================================================
// Мульти-аутпут (Спринт 3, Вариант A): один вход → N выходов одной командой.
// Один декод входа, поток ветвится через split на N выходных секций. Ключевая сложность:
// в filter_complex каждый лейбл потребляется РОВНО один раз — поэтому поток, который кормит
// несколько потребителей (несколько фильтр-веток или несколько выходов), надо размножить
// через split/asplit. См. complex/labels.ts (splitFragment), docs/ARCHITECTURE.md.
// =========================================================================================

// Сколько РАЗ поток ноды (видео/аудио) читается ниже по графу. Считаем по рёбрам:
// каждое исходящее ребро ноды — один потребитель её потоков. Если >1 — нужен split.
interface UseCount {
  v: number;
  a: number;
}

export function buildMultiOutputPlan(
  graph: Graph,
  inputPaths: Map<string, string>,
): MultiOutputResult {
  const ordered = topoSort(graph);
  if (ordered === null) {
    return { error: "Соедини ноды: вход → фильтры → выход" };
  }

  const labeler = makeLabeler();
  const streams = new Map<string, NodeStreams>(); // выходные лейблы каждой ноды
  const fragments: string[] = [];
  const inputs: string[] = [];

  // Каждая нода может ветвиться: для лейбла, читаемого N>1 раз, заводим split-ветки и
  // раздаём по одной каждому потребителю. branchQueues: nodeId → очередь готовых веток.
  const useCount = countUses(graph, ordered);
  const branchQueues = new Map<string, { v: StreamLabel[]; a: StreamLabel[] }>();

  // Взять очередную ветку потока ноды (видео/аудио) для одного потребителя. Если поток
  // читается единожды — отдаём сам лейбл; если несколько раз — поочерёдно ветки split.
  const takeBranch = (nodeId: string, kind: "v" | "a"): StreamLabel | null => {
    const s = streams.get(nodeId);
    const base = s ? s[kind] : null;
    if (base === null) return null;
    const count = useCount.get(nodeId)?.[kind] ?? 0;
    if (count <= 1) return base; // один потребитель — split не нужен
    let q = branchQueues.get(nodeId);
    if (!q) {
      q = { v: [], a: [] };
      branchQueues.set(nodeId, q);
    }
    if (q[kind].length === 0) {
      // Впервые понадобилась ветка — создаём split на нужное число потребителей
      const branches = Array.from({ length: count }, () =>
        kind === "v" ? labeler.nextVideo() : labeler.nextAudio(),
      );
      fragments.push(splitFragment(base, branches, kind));
      q[kind] = branches;
    }
    return q[kind].shift() ?? base;
  };

  for (const node of ordered) {
    if (node.kind === "input") {
      const idx = inputs.length;
      const path = inputPaths.get(node.id);
      if (!path) return { error: "Вход без выбранного файла", invalidNodeIds: [node.id] };
      inputs.push(path);
      streams.set(node.id, { v: inputLabel(idx, "v"), a: inputLabel(idx, "a") });
      continue;
    }
    if (node.kind === "output") continue;

    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) {
      return { error: `Неизвестный фильтр: ${node.filterId}`, invalidNodeIds: [node.id] };
    }

    // Входные потоки ноды — берём ВЕТКИ предшественников (split, если те ветвятся),
    // упорядоченные по targetHandle (для merge важен порядок основной/накладка).
    const incoming = orderedIncomingBranches(graph, node.id, takeBranch);
    if (incoming === null) {
      return { error: `Не хватает входа для «${def.label}»`, invalidNodeIds: [node.id] };
    }

    if (def.merge) {
      const vIn = incoming.map((s) => s.v).filter((l): l is string => l !== null);
      const aIn = incoming.map((s) => s.a).filter((l): l is string => l !== null);
      const vOut = labeler.nextVideo();
      const aOut = def.merge.audioInputs ? labeler.nextAudio() : undefined;
      fragments.push(def.merge.toComplex({ vIn, aIn, vOut, aOut, params: node.params }));
      streams.set(node.id, { v: vOut, a: aOut ?? null });
      continue;
    }

    const prev = incoming[0];
    const contrib = def.toCommand(node.params);
    let vOut = prev.v;
    if (contrib.vf && prev.v) {
      vOut = labeler.nextVideo();
      fragments.push(`${bracket(prev.v)}${contrib.vf}${bracket(vOut)}`);
    }
    streams.set(node.id, { v: vOut, a: prev.a });
  }

  // По выходу: поднимаемся к предшественнику и берём его ВЕТКУ + собираем outputArgs веток,
  // ведущих именно к этому выходу. Порядок выходов = порядок outputNodes графа.
  const outputs: OutputPlan[] = [];
  for (const out of outputNodes(graph)) {
    const incoming = incomingEdges(graph, out.id);
    if (incoming.length === 0) return { error: "Цепочка не доходит до выхода", invalidNodeIds: [out.id] };
    const srcId = incoming[0].source;
    outputs.push({
      nodeId: out.id,
      mapVideo: takeBranch(srcId, "v"),
      mapAudio: takeBranch(srcId, "a"),
      outputArgs: collectOutputArgs(graph, out.id),
    });
  }

  return { inputs, filterComplex: fragments.join(";"), outputs };
}

// Посчитать, сколько раз поток (видео/аудио) каждой ноды читается ниже по графу.
// Каждое исходящее ребро = один потребитель потоков ноды-источника (видео и аудио).
// Выход потребляет и видео, и аудио источника; фильтр/merge — по своему входу (упрощённо
// считаем потребление и видео, и аудио на ребро: лишний split в ветке без аудио безвреден,
// т.к. takeBranch создаёт split только когда поток реально не null и читается >1 раза).
function countUses(graph: Graph, ordered: GraphNode[]): Map<string, UseCount> {
  const counts = new Map<string, UseCount>();
  for (const n of ordered) counts.set(n.id, { v: 0, a: 0 });
  for (const n of ordered) {
    if (n.kind === "output") continue;
    const outs = outgoingEdges(graph, n.id);
    const c = counts.get(n.id)!;
    c.v += outs.length;
    c.a += outs.length;
  }
  return counts;
}

// Входные ветки ноды, упорядоченные по targetHandle (как orderedIncomingStreams, но берёт
// split-ветку через takeBranch вместо общего лейбла). null — если предшественник не построен.
function orderedIncomingBranches(
  graph: Graph,
  nodeId: string,
  takeBranch: (nodeId: string, kind: "v" | "a") => StreamLabel | null,
): NodeStreams[] | null {
  const incoming = incomingEdges(graph, nodeId);
  if (incoming.length === 0) return null;
  const sorted = [...incoming].sort((a, b) => {
    const ha = a.targetHandle ?? "￿";
    const hb = b.targetHandle ?? "￿";
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  return sorted.map((e) => ({ v: takeBranch(e.source, "v"), a: takeBranch(e.source, "a") }));
}

// Собрать outputArgs ветки, ведущей к данному выходу: поднимаемся по основным входящим
// рёбрам от выхода до входа, складывая outputArgs каждой filter-ноды на пути. Так у каждого
// выхода свои кодеки/-f (напр. один выход H.264, другой H.265), заданные нодами его ветки.
function collectOutputArgs(graph: Graph, outputId: string): string[] {
  const args: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = incomingEdges(graph, outputId)[0]?.source;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = graph.nodes.find((n) => n.id === cur);
    if (!node) break;
    if (node.kind === "input") break;
    if (node.filterId) {
      const def = getFilterDef(node.filterId);
      const extra = def?.toCommand(node.params).outputArgs;
      if (extra) args.unshift(...extra); // ближе к входу — раньше в команде
    }
    cur = incomingEdges(graph, cur)[0]?.source;
  }
  return args;
}
