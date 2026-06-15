// Категория «Обрезка» — фильтры, вырезающие фрагмент по времени или кадру.
import type { FilterDef } from "./types";

const CATEGORY = "Обрезка";

// Обрезать по времени
export const trim: FilterDef = {
  id: "trim",
  category: CATEGORY,
  label: "Обрезать по времени",
  description:
    "Оставляет только фрагмент между началом и концом. Зачем: вырезать нужный " +
    "кусок из длинного видео без перекодирования всего.",
  params: [
    { id: "start", label: "Начало (сек)", type: "number", default: 0 },
    { id: "end", label: "Конец (сек)", type: "number", default: 10 },
  ],
  toCommand: (p) => ({ vf: `trim=start=${p.start}:end=${p.end}` }),
};

// Кадрировать (обрезать края)
export const crop: FilterDef = {
  id: "crop",
  category: CATEGORY,
  label: "Кадрировать",
  description:
    "Вырезает прямоугольную область кадра. Зачем: убрать чёрные поля, сменить " +
    "соотношение сторон (16:9 → 1:1 для соцсетей).",
  params: [
    { id: "w", label: "Ширина области", type: "number", default: 640 },
    { id: "h", label: "Высота области", type: "number", default: 640 },
  ],
  toCommand: (p) => ({ vf: `crop=${p.w}:${p.h}` }),
};
