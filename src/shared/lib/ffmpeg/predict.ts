// Предсказание характеристик результата из графа. Вторая чистая функция рядом с generate.ts:
// если generate.ts даёт «граф → аргументы команды», то здесь «граф + вход → итоговые
// характеристики» (разрешение, fps, длительность, кодек…). Считается на лету, до рендера.
// Поддерживает DAG: ветвление (GIF) и слияние потоков (overlay/concat) через топо-обход.
// См. docs/ARCHITECTURE.md §4.
//
// Размер файла (size_bytes) — ОЦЕНКА (N-010): считаем из итоговых битрейтов и длительности
// (size ≈ (video_bitrate + audio_bitrate) × duration / 8). Операции корректируют битрейт
// (scale/fps — ∝ пикселям/fps; compress/codec — от CRF). Точным он быть не может (зависит
// от контента), поэтому в UI помечен «≈». После рендера панель показывает реальный размер.
import type { Graph } from "../../types/graph";
import type { MediaInfo } from "../../types/media";
import { topoSort, incomingEdges } from "./dag";
import { getFilterDef } from "./catalog";
import { estimateSize } from "./size";

// Прогнать граф, накапливая характеристики на выходе каждой ноды (топо-порядок).
// input — MediaInfo ОСНОВНОГО входа (обратная совместимость с линейным случаем).
// inputInfos — характеристики по id input-нод (multi-input: overlay/concat); если нет
// записи для входа, берётся общий input (для единственного/основного входа).
// outputNodeId — для какого выхода считать (мульти-аутпут: у каждого выхода своя ветка с
//   разными характеристиками). Не задан — берётся первый output (обратная совместимость).
// null — если входа нет или граф не собран (нет валидного пути к выходу).
export function predictOutput(
  graph: Graph,
  input: MediaInfo | null,
  inputInfos?: Map<string, MediaInfo | null>,
  outputNodeId?: string,
): MediaInfo | null {
  if (!input && (!inputInfos || inputInfos.size === 0)) return null;

  const ordered = topoSort(graph);
  if (ordered === null) return null; // граф не собран — результата нет

  // MediaInfo на выходе каждой ноды
  const out = new Map<string, MediaInfo | null>();

  for (const node of ordered) {
    if (node.kind === "input") {
      // Характеристики входа: из карты по id, иначе общий input (основной вход)
      out.set(node.id, inputInfos?.get(node.id) ?? input);
      continue;
    }
    if (node.kind === "output") continue;

    // filter-нода: входы — от предшественников, упорядоченные по targetHandle
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    const ins = orderedIncomingInfos(graph, node.id, out);

    if (def?.merge?.applyMerge) {
      // Слияние: primary — первый вход (мин. targetHandle), secondary — второй (если есть)
      const primary = ins[0] ?? null;
      const secondary = ins[1] ?? null;
      out.set(node.id, primary ? def.merge.applyMerge(primary, secondary, node.params) : null);
    } else if (def?.applyToInfo) {
      const prev = ins[0] ?? null;
      out.set(node.id, prev ? def.applyToInfo(prev, node.params) : null);
    } else {
      // Фильтр без applyToInfo характеристики не меняет (поворот 180°, цвет, отражение)
      out.set(node.id, ins[0] ?? null);
    }
  }

  // Целевой выход: заданный outputNodeId (мульти-аутпут) либо первый output (совместимость).
  const output = outputNodeId
    ? ordered.find((n) => n.kind === "output" && n.id === outputNodeId)
    : ordered.find((n) => n.kind === "output");
  if (!output) return null;
  // Результат — характеристики на входе output-ноды (её единственного предшественника)
  const incoming = incomingEdges(graph, output.id);
  if (incoming.length === 0) return null;
  const result = out.get(incoming[0].source) ?? null;
  if (!result) return null;

  // Размер пересчитываем (оценка, N-010) ТОЛЬКО если операции реально повлияли на битрейт
  // или длительность относительно исходного входа. Иначе показываем РЕАЛЬНЫЙ размер входа
  // (он точнее любой оценки — операции, не трогающие размер, его не меняют).
  // Базой сравнения берём info входа ветки, ведущей к ЭТОМУ выходу (мульти-аутпут: у разных
  // выходов разные ветки → разные базовые входы при нескольких входах).
  const sourceInfo = baseInputInfo(graph, output.id, input, inputInfos);
  const sizeChanged =
    sourceInfo == null ||
    result.video_bitrate !== sourceInfo.video_bitrate ||
    result.audio_bitrate !== sourceInfo.audio_bitrate ||
    result.duration !== sourceInfo.duration;
  if (!sizeChanged) return result; // ничего не повлияло на размер — реальный size_bytes входа
  return { ...result, size_bytes: estimateSize(result) };
}

// Info входа, от которого идёт ветка к указанному выходу (для сравнения «изменился ли размер»).
// Идём по основным предшественникам от output до input-ноды.
function baseInputInfo(
  graph: Graph,
  outputId: string,
  input: MediaInfo | null,
  inputInfos?: Map<string, MediaInfo | null>,
): MediaInfo | null {
  // Поднимаемся по первому входящему ребру до input-ноды
  let cur = incomingEdges(graph, outputId)[0]?.source;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = graph.nodes.find((n) => n.id === cur);
    if (!node) break;
    if (node.kind === "input") return inputInfos?.get(node.id) ?? input;
    cur = incomingEdges(graph, cur)[0]?.source;
  }
  return input;
}

// Характеристики на входах ноды, упорядоченные по targetHandle (как в complex/build.ts:
// меньший handle — основной/первый вход). Отсутствие handle → в конец.
function orderedIncomingInfos(
  graph: Graph,
  nodeId: string,
  out: Map<string, MediaInfo | null>,
): (MediaInfo | null)[] {
  const incoming = [...incomingEdges(graph, nodeId)].sort((a, b) => {
    const ha = a.targetHandle ?? "￿";
    const hb = b.targetHandle ?? "￿";
    return ha < hb ? -1 : ha > hb ? 1 : 0;
  });
  return incoming.map((e) => out.get(e.source) ?? null);
}
