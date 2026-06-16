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
  streams: { needsVideo: true }, // -c:v перекодирует видео — нужен видеопоток
  // Перекодирование в H.264. Размер файла честно не предсказываем (зависит от CRF и контента).
  applyToInfo: (info) => ({ ...info, video_codec: "h264" }),
};

// Сменить видеокодек. Энкодер и итоговый кодек по выбору пользователя.
const CODEC_ENCODER: Record<string, string> = {
  "H.264": "libx264",
  "H.265 / HEVC": "libx265",
  "VP9": "libvpx-vp9",
};
const CODEC_NAME: Record<string, string> = {
  "H.264": "h264",
  "H.265 / HEVC": "hevc",
  "VP9": "vp9",
};

export const changeCodec: FilterDef = {
  id: "codec",
  category: CATEGORY,
  label: "Сменить кодек",
  description:
    "Перекодирует видео в выбранный кодек. Зачем: H.265/VP9 дают меньший файл при том же " +
    "качестве (но медленнее и хуже совместимость), H.264 — самый совместимый.",
  params: [
    {
      id: "codec",
      label: "Кодек",
      type: "enum",
      default: "H.264",
      options: ["H.264", "H.265 / HEVC", "VP9"],
    },
  ],
  toCommand: (p) => ({
    outputArgs: ["-c:v", CODEC_ENCODER[String(p.codec)] ?? "libx264"],
  }),
  streams: { needsVideo: true }, // -c:v перекодирует видео — нужен видеопоток
  applyToInfo: (info, p) => ({
    ...info,
    video_codec: CODEC_NAME[String(p.codec)] ?? "h264",
  }),
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
  streams: { dropsVideo: true }, // -vn: убирает видео
  // Видеодорожка отбрасывается — все видеохарактеристики становятся «нет»
  applyToInfo: (info) => ({
    ...info,
    video_codec: null,
    video_codec_long: null,
    video_profile: null,
    video_bitrate: null,
    aspect_ratio: null,
    pix_fmt: null,
    color_space: null,
    frame_count: null,
    width: null,
    height: null,
    fps: null,
  }),
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
  streams: { dropsAudio: true }, // -an: убирает звук
  // Звуковая дорожка удаляется — все аудиохарактеристики «нет»
  applyToInfo: (info) => ({
    ...info,
    audio_codec: null,
    audio_codec_long: null,
    audio_bitrate: null,
    audio_sample_rate: null,
    audio_channels: null,
    channel_layout: null,
    sample_fmt: null,
  }),
};
