// Категория «Конвертация / Сжатие» — операции, влияющие на выходные опции (не на -vf).
// Используют outputArgs (флаги команды). См. docs/ARCHITECTURE.md §3.
import type { FilterDef } from "./types";

const CATEGORY = "Конвертация / Сжатие";

// Сжать видео (CRF — постоянное качество). Меньше CRF = лучше качество и больше файл.
export const compress: FilterDef = {
  id: "compress",
  category: CATEGORY,
  label: "Сжать видео",
  description:
    "Уменьшает вес файла через H.264 с заданным качеством (CRF). Зачем: отправить " +
    "по мессенджеру, выложить в сеть. 18 — почти без потерь, 23 — норма, 28 — заметно сжато.",
  params: [
    {
      id: "crf",
      label: "Качество (CRF)",
      type: "number",
      default: 23,
      hint: "меньше = лучше качество, больше файл (18–28)",
    },
  ],
  toCommand: (p) => ({ outputArgs: ["-c:v", "libx264", "-crf", String(p.crf)] }),
};

// Извлечь аудио — выкинуть видеодорожку, оставить звук
export const extractAudio: FilterDef = {
  id: "extract_audio",
  category: CATEGORY,
  label: "Извлечь аудио",
  description:
    "Сохраняет только звуковую дорожку без видео. Зачем: достать музыку/голос из ролика. " +
    "Видео отбрасывается (-vn), аудио копируется без перекодирования.",
  params: [],
  toCommand: () => ({ outputArgs: ["-vn", "-c:a", "copy"] }),
};

// Убрать звук — оставить видео без аудио
export const removeAudio: FilterDef = {
  id: "remove_audio",
  category: CATEGORY,
  label: "Убрать звук",
  description:
    "Удаляет звуковую дорожку, оставляя видео. Зачем: убрать лишний/шумный звук, " +
    "сделать немой клип. Видео копируется без перекодирования (-an).",
  params: [],
  toCommand: () => ({ outputArgs: ["-an"] }),
};
