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
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};

// Повышение резкости через фильтр unsharp
export const sharpen: FilterDef = {
  id: "sharpen",
  category: CATEGORY,
  label: "Резкость",
  description:
    "Повышает чёткость деталей (фильтр unsharp). Зачем: вытянуть слегка мягкую картинку. " +
    "Сила: 0.5 — лёгкая, 1.5 — заметная. Слишком большая даёт «звон» по краям и шум.",
  params: [
    {
      id: "amount",
      label: "Сила",
      type: "number",
      default: 1,
      hint: "0.5 = лёгкая, 1.5 = заметная",
    },
  ],
  // unsharp luma_msize_x:luma_msize_y:luma_amount — размер матрицы 5×5, сила по яркости
  toCommand: (p) => ({ vf: `unsharp=5:5:${p.amount}` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
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
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};
