// Построитель -filter_complex из DAG-графа. Топо-обход: для каждой ноды вычисляем
// её выходные лейблы видео/аудио потоков и накапливаем фрагменты filter_complex.
// Обычный фильтр оборачивается в лейблы ([prev]scale=...[v1]); merge-операция строит
// фрагмент сама через MergeSpec.toComplex. См. complex/types.ts, dag.ts, docs/ARCHITECTURE.md.
import type { Graph, GraphNode } from "../../../types/graph";
import { getFilterDef } from "../catalog";
import { topoSort, incomingEdges } from "../dag";
import type { ComplexResult, StreamLabel } from "./types";
import { makeLabeler, inputLabel, bracket } from "./labels";

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
