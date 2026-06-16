// Категория «Скорость» — изменение скорости воспроизведения (видеофильтр setpts).
import type { FilterDef } from "./types";

const CATEGORY = "Скорость";

// Изменить скорость видео. setpts=PTS/factor: factor>1 ускоряет, <1 замедляет.
// Примечание: меняет только видеодорожку (звук рассинхронизируется — это техдолг, см. CODE_NOTES).
export const speed: FilterDef = {
  id: "speed",
  category: CATEGORY,
  label: "Изменить скорость",
  description:
    "Ускоряет или замедляет видео. Зачем: таймлапс (ускорить в 4×), slow-motion " +
    "(замедлить в 2×). Множитель 2 = вдвое быстрее, 0.5 = вдвое медленнее.",
  params: [
    {
      id: "factor",
      label: "Множитель",
      type: "number",
      default: 2,
      hint: ">1 быстрее, <1 медленнее (напр. 0.5)",
    },
  ],
  // PTS делится на множитель: factor=2 → setpts=PTS/2 (быстрее)
  toCommand: (p) => ({ vf: `setpts=PTS/${p.factor}` }),
  streams: { needsVideo: true }, // видеофильтр (setpts) — нужен видеопоток
  // Длительность делится на множитель (×2 → вдвое короче). FPS не меняется.
  applyToInfo: (info, p) => {
    const factor = Number(p.factor);
    return {
      ...info,
      duration: info.duration != null && factor ? info.duration / factor : info.duration,
    };
  },
};
