// Категория «Звук» — аудиофильтры (вкладываются в -af).
import type { FilterDef } from "./types";

const CATEGORY = "Звук";

// Изменить громкость звука (множитель: 2.0 = громче вдвое, 0.5 = тише вдвое)
export const volume: FilterDef = {
  id: "volume",
  category: CATEGORY,
  label: "Громкость",
  description:
    "Меняет громкость звука. Зачем: поднять тихую запись или приглушить громкую. " +
    "Множитель: 2 — вдвое громче, 0.5 — вдвое тише, 1 — без изменений.",
  params: [
    {
      id: "factor",
      label: "Множитель",
      type: "number",
      default: 1.5,
      hint: "2 = громче вдвое, 0.5 = тише вдвое",
    },
  ],
  toCommand: (p) => ({ af: `volume=${p.factor}` }),
  streams: { needsAudio: true }, // аудиофильтр — нужен аудиопоток
};

// Нормализация громкости к стандарту вещания (EBU R128, фильтр loudnorm)
export const loudnorm: FilterDef = {
  id: "loudnorm",
  category: CATEGORY,
  label: "Нормализация звука",
  description:
    "Выравнивает громкость к стандарту вещания EBU R128 (фильтр loudnorm). Зачем: " +
    "привести тихие и громкие участки к единому уровню, чтобы не крутить ручку. " +
    "Без параметров — целевой уровень по умолчанию (−24 LUFS).",
  params: [],
  toCommand: () => ({ af: "loudnorm" }),
  streams: { needsAudio: true }, // аудиофильтр — нужен аудиопоток
};
