// Предсказание характеристик результата из графа. Вторая чистая функция рядом с generate.ts:
// если generate.ts даёт «граф → аргументы команды», то здесь «граф + вход → итоговые
// характеристики» (разрешение, fps, длительность, кодек…). Считается на лету, до рендера.
// Поддерживает DAG: ветвление (GIF) и слияние потоков (overlay/concat) через топо-обход.
// См. docs/ARCHITECTURE.md §4.
//
// Честность: размер файла (size_bytes) точно предсказать нельзя — зависит от битрейта,
// CRF и содержимого. Операции его не трогают; в UI он помечается как «≈ оценка» (от входа).
import type { Graph } from "../../types/graph";
import type { MediaInfo } from "../../types/media";
import { topoSort, incomingEdges } from "./dag";
import { getFilterDef } from "./catalog";

// Прогнать граф, накапливая характеристики на выходе каждой ноды (топо-порядок).
// input — MediaInfo ОСНОВНОГО входа (обратная совместимость с линейным случаем).
// inputInfos — характеристики по id input-нод (multi-input: overlay/concat); если нет
// записи для входа, берётся общий input (для единственного/основного входа).
// null — если входа нет или граф не собран (нет валидного пути к выходу).
export function predictOutput(
  graph: Graph,
  input: MediaInfo | null,
  inputInfos?: Map<string, MediaInfo | null>,
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

  // Результат — характеристики на входе output-ноды (её единственного предшественника)
  const output = ordered.find((n) => n.kind === "output")!;
  const incoming = incomingEdges(graph, output.id);
  if (incoming.length === 0) return null;
  return out.get(incoming[0].source) ?? null;
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
