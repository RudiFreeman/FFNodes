// Категория «Размер / FPS» — фильтры, меняющие геометрию и частоту кадров.
import type { FilterDef } from "./types";

const CATEGORY = "Размер / FPS";

// Изменить разрешение видео
export const scale: FilterDef = {
  id: "scale",
  category: CATEGORY,
  label: "Изменить размер",
  description:
    "Меняет разрешение видео. Зачем: уменьшить файл, подогнать под платформу " +
    "(например 1080p → 720p) или соцсеть. Высота -2 сохраняет пропорции.",
  params: [
    { id: "width", label: "Ширина", type: "number", default: 1280, hint: "в пикселях" },
    {
      id: "height",
      label: "Высота",
      type: "number",
      default: -2,
      hint: "-2 = авто по пропорциям",
    },
  ],
  toFilterString: (p) => `scale=${p.width}:${p.height}`,
};

// Сменить частоту кадров
export const fps: FilterDef = {
  id: "fps",
  category: CATEGORY,
  label: "Сменить частоту кадров",
  description:
    "Задаёт число кадров в секунду (FPS). Зачем: уменьшить вес (например для GIF " +
    "хватает 10–15 fps) или привести к стандарту (24/30/60).",
  params: [
    { id: "value", label: "Кадров в секунду", type: "number", default: 30 },
  ],
  toFilterString: (p) => `fps=${p.value}`,
};
