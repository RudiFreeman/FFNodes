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
