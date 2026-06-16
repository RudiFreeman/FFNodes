// Категория «Эффекты» — видеоэффекты, не вошедшие в другие категории.
import type { FilterDef } from "./types";

const CATEGORY = "Эффекты";

// Плавное появление/затемнение (fade in/out)
export const fade: FilterDef = {
  id: "fade",
  category: CATEGORY,
  label: "Затухание",
  description:
    "Плавное появление из чёрного (in) или затемнение в чёрный (out). Зачем: мягкое " +
    "начало/конец клипа. Для затемнения в конце задай «Начало» = длительность минус секунды эффекта.",
  params: [
    {
      id: "type",
      label: "Тип",
      type: "enum",
      default: "Появление",
      options: ["Появление", "Затемнение"],
    },
    { id: "start", label: "Начало (сек)", type: "number", default: 0 },
    { id: "duration", label: "Длительность (сек)", type: "number", default: 1 },
  ],
  toCommand: (p) => {
    const t = p.type === "Затемнение" ? "out" : "in";
    return { vf: `fade=t=${t}:st=${p.start}:d=${p.duration}` };
  },
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};

// Размытие кадра (гауссово, фильтр gblur)
export const blur: FilterDef = {
  id: "blur",
  category: CATEGORY,
  label: "Размытие",
  description:
    "Гауссово размытие кадра (фильтр gblur). Зачем: скрыть фон, смягчить картинку, " +
    "стилизация. Радиус: 2 — лёгкое, 10 — сильное.",
  params: [
    {
      id: "sigma",
      label: "Радиус",
      type: "number",
      default: 5,
      hint: "2 = лёгкое, 10 = сильное",
    },
  ],
  toCommand: (p) => ({ vf: `gblur=sigma=${p.sigma}` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};

// Виньетка — мягкое затемнение по краям кадра
export const vignette: FilterDef = {
  id: "vignette",
  category: CATEGORY,
  label: "Виньетка",
  description:
    "Мягко затемняет края кадра, фокусируя взгляд на центре (фильтр vignette). Зачем: " +
    "винтажный/кинематографичный вид. Угол: меньше — сильнее затемнение по краям.",
  params: [
    {
      id: "angle",
      label: "Угол",
      type: "number",
      default: 0.8,
      hint: "меньше = сильнее затемнение (норма ≈ π/5 ≈ 0.63…1)",
    },
  ],
  toCommand: (p) => ({ vf: `vignette=angle=${p.angle}` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};

// Проиграть видео задом наперёд
export const reverse: FilterDef = {
  id: "reverse",
  category: CATEGORY,
  label: "Реверс",
  description:
    "Проигрывает видео задом наперёд. Зачем: эффект обратной перемотки. Внимание: " +
    "тяжёлая операция — FFmpeg грузит весь клип в память, для длинных видео медленно.",
  params: [],
  toCommand: () => ({ vf: "reverse" }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};
