// Предсказание характеристик результата из графа. Вторая чистая функция рядом с generate.ts:
// если generate.ts даёт «граф → аргументы команды», то здесь «граф + вход → итоговые
// характеристики» (разрешение, fps, длительность, кодек…). Считается на лету, до рендера.
// См. docs/ARCHITECTURE.md §4.
//
// Честность: размер файла (size_bytes) точно предсказать нельзя — зависит от битрейта,
// CRF и содержимого. Операции его не трогают; в UI он помечается как «≈ оценка» (от входа).
import type { Graph } from "../../types/graph";
import type { MediaInfo } from "../../types/media";
import { orderedFilters } from "./chain";
import { getFilterDef } from "./catalog";

// Прогнать вход через цепочку фильтров, накапливая изменения характеристик.
// null — если входа нет (нечего предсказывать) или цепочка разорвана (нет валидного результата).
export function predictOutput(graph: Graph, input: MediaInfo | null): MediaInfo | null {
  if (!input) return null;

  const ordered = orderedFilters(graph);
  if (ordered === null) return null; // цепочка не собрана — результата нет

  let info: MediaInfo = input;
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    // Фильтр без applyToInfo характеристики не меняет (напр. поворот 180°, цвет, отражение)
    if (def?.applyToInfo) info = def.applyToInfo(info, node.params);
  }
  return info;
}
