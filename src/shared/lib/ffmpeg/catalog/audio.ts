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

// Плавное появление/угасание звука (afade) — аудио-аналог «Затухания»
export const audioFade: FilterDef = {
  id: "audio_fade",
  category: CATEGORY,
  label: "Затухание звука",
  description:
    "Плавное нарастание звука из тишины (in) или угасание в тишину (out) — фильтр afade. " +
    "Зачем: мягкое начало/конец без резкого щелчка. Для угасания в конце задай «Начало» = " +
    "длительность минус секунды эффекта.",
  params: [
    {
      id: "type",
      label: "Тип",
      type: "enum",
      default: "Нарастание",
      options: ["Нарастание", "Угасание"],
    },
    { id: "start", label: "Начало (сек)", type: "number", default: 0 },
    { id: "duration", label: "Длительность (сек)", type: "number", default: 1 },
  ],
  toCommand: (p) => {
    const t = p.type === "Угасание" ? "out" : "in";
    return { af: `afade=t=${t}:st=${p.start}:d=${p.duration}` };
  },
  streams: { needsAudio: true }, // аудиофильтр — нужен аудиопоток
};

// Свести звук в моно (одна дорожка вместо стерео)
export const mono: FilterDef = {
  id: "mono",
  category: CATEGORY,
  label: "Монофонический звук",
  description:
    "Сводит стерео в один канал (моно) — опция -ac 1. Зачем: уменьшить вес, убрать " +
    "разнобой каналов, подготовить голосовую запись. Стерео-эффекты при этом теряются.",
  params: [],
  toCommand: () => ({ outputArgs: ["-ac", "1"] }),
  streams: { needsAudio: true }, // меняет аудиодорожку — нужен аудиопоток
  // Каналы становятся 1; раскладку каналов помечаем «mono»
  applyToInfo: (info) => ({ ...info, audio_channels: 1, channel_layout: "mono" }),
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
