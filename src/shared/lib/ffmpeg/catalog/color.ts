// Категория «Цвет / Яркость» — цветокоррекция кадра (видеофильтры).
import type { FilterDef } from "./types";

const CATEGORY = "Цвет / Яркость";

// Яркость, контраст, насыщенность через фильтр eq
export const adjust: FilterDef = {
  id: "adjust",
  category: CATEGORY,
  label: "Яркость / Контраст",
  description:
    "Подстраивает яркость, контраст и насыщенность. Зачем: вытянуть тёмное видео, " +
    "сделать картинку сочнее. Яркость 0 — без изменений (−1…1), контраст/насыщенность 1 — норма.",
  params: [
    { id: "brightness", label: "Яркость", type: "number", default: 0, hint: "−1…1, 0 = без изменений" },
    { id: "contrast", label: "Контраст", type: "number", default: 1, hint: "1 = норма" },
    { id: "saturation", label: "Насыщенность", type: "number", default: 1, hint: "1 = норма, 0 = ч/б" },
  ],
  toCommand: (p) => ({
    vf: `eq=brightness=${p.brightness}:contrast=${p.contrast}:saturation=${p.saturation}`,
  }),
};

// Чёрно-белое
export const grayscale: FilterDef = {
  id: "grayscale",
  category: CATEGORY,
  label: "Чёрно-белое",
  description:
    "Убирает цвет, оставляя оттенки серого. Зачем: стильный ч/б эффект, " +
    "акцент на форме и свете вместо цвета.",
  params: [],
  toCommand: () => ({ vf: "hue=s=0" }),
};
