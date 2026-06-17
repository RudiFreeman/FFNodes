// Индекс каталога фильтров — единый источник правды по доступным операциям.
// Из него питается и UI каталога (справа), и будущий генератор команды.
// См. docs/ARCHITECTURE.md §3. Добавить фильтр = импортировать его сюда в CATALOG.
import type { FilterDef } from "./types";
import { scale, pad, fps } from "./resize";
import { trim, crop } from "./trim";
import { compress, extractAudio, removeAudio, changeCodec } from "./convert";
import { rotate, rotateAngle, flip } from "./transform";
import { speed } from "./speed";
import { adjust, sharpen, grayscale } from "./color";
import { toGif } from "./gif";
import { volume, audioFade, mono, loudnorm } from "./audio";
import { fade, blur, vignette, reverse } from "./effects";

export type { FilterDef, FilterParam, ParamType, CommandContribution } from "./types";

// Все доступные операции каталога
export const CATALOG: FilterDef[] = [
  scale,
  pad,
  fps,
  trim,
  crop,
  compress,
  changeCodec,
  extractAudio,
  removeAudio,
  rotate,
  rotateAngle,
  flip,
  speed,
  adjust,
  sharpen,
  grayscale,
  toGif,
  volume,
  audioFade,
  mono,
  loudnorm,
  fade,
  blur,
  vignette,
  reverse,
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
