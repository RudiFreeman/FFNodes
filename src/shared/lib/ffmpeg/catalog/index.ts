// Индекс каталога фильтров — единый источник правды по доступным операциям.
// Из него питается и UI каталога (справа), и будущий генератор команды.
// См. docs/ARCHITECTURE.md §3. Добавить фильтр = импортировать его сюда в CATALOG.
import type { FilterDef } from "./types";
import { scale, fps } from "./resize";
import { trim, crop } from "./trim";
import { compress, extractAudio, removeAudio } from "./convert";
import { rotate, flip } from "./transform";
import { speed } from "./speed";
import { adjust, grayscale } from "./color";
import { toGif } from "./gif";

export type { FilterDef, FilterParam, ParamType, CommandContribution } from "./types";

// Все доступные операции каталога
export const CATALOG: FilterDef[] = [
  scale,
  fps,
  trim,
  crop,
  compress,
  extractAudio,
  removeAudio,
  rotate,
  flip,
  speed,
  adjust,
  grayscale,
  toGif,
];

// Найти фильтр по id (для ноды на холсте)
export function getFilterDef(id: string): FilterDef | undefined {
  return CATALOG.find((f) => f.id === id);
}

// Сгруппировать фильтры по категориям — для рендера каталога справа
export function catalogByCategory(): { category: string; items: FilterDef[] }[] {
  const groups = new Map<string, FilterDef[]>();
  for (const def of CATALOG) {
    const list = groups.get(def.category) ?? [];
    list.push(def);
    groups.set(def.category, list);
  }
  return Array.from(groups, ([category, items]) => ({ category, items }));
}
