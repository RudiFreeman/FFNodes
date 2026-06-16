// Извлечение vf-цепочки из графа для превью-кадра «После».
// Чистая функция, переиспользует обход цепочки (chain.ts) и вклад операций (toCommand).
// В отличие от generate.ts здесь нужны ТОЛЬКО видеофильтры (-vf): кодек/контейнер-опции
// (outputArgs) для одного JPEG-кадра не нужны. См. docs/ARCHITECTURE.md §4.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";

// Собрать строку -vf из графа: фрагменты фильтров через запятую (порядок цепочки).
// Возвращает:
//   - строку фильтров (напр. "scale=640:-1,hflip"), если цепочка цела и в ней есть vf;
//   - "" (пустая строка), если цепочка цела, но видеофильтров нет (кадр = исходник);
//   - null, если цепочка разорвана/неполна (кадр «После» строить не из чего).
export function videoFilterChain(graph: Graph): string | null {
  const ordered = orderedFilters(graph);
  if (ordered === null) return null;

  const parts: string[] = [];
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) return null; // неизвестный фильтр — не строим кадр
    const contrib = def.toCommand(node.params);
    if (contrib.vf) parts.push(contrib.vf);
  }
  return parts.join(",");
}
