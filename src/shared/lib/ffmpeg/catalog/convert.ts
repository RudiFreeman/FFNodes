// Категория «Конвертация / Сжатие» — операции, влияющие на выходные опции (не на -vf).
// Используют outputArgs (флаги команды). См. docs/ARCHITECTURE.md §3.
import type { FilterDef } from "./types";
import { estimateBitrateFromCrf } from "../size";

const CATEGORY = "Конвертация / Сжатие";

// Относительная эффективность кодеков (множитель к битрейту при том же качестве).
// H.265/VP9 при той же визуальной чёткости дают ~меньший битрейт, чем H.264.
const CODEC_BITRATE_FACTOR: Record<string, number> = {
  "H.264": 1.0,
  "H.265 / HEVC": 0.6, // ~40% экономии при том же качестве
  VP9: 0.65,
};

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
  // Перекодирование в H.264 с заданным CRF. Битрейт оцениваем из CRF+разрешения+fps (N-010):
  // это эмпирика (точный зависит от контента), в UI помечен «≈».
  applyToInfo: (info, p) => ({
    ...info,
    video_codec: "h264",
    video_bitrate:
      estimateBitrateFromCrf(info.width, info.height, info.fps, Number(p.crf)) ??
      info.video_bitrate,
  }),
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
// Обратная карта: имя кодека из ffprobe (info.video_codec) → label опции. Для дефолта
// «текущий кодек входа». Кодеки вне списка опций (напр. av1, mpeg4) дефолта не дают.
const CODEC_LABEL: Record<string, string> = {
  h264: "H.264",
  hevc: "H.265 / HEVC",
  vp9: "VP9",
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
  // Дефолт = текущий кодек входа (хедлайн-сценарий: H.264 уже стоит, осталось сменить на H.265).
  // Кодек вне списка опций (av1…) → дефолта нет, остаётся статичный "H.264".
  defaultsFromInfo: (info) => {
    const label = info.video_codec ? CODEC_LABEL[info.video_codec] : undefined;
    return label ? { codec: label } : {};
  },
  applyToInfo: (info, p) => {
    const codec = String(p.codec);
    const factor = CODEC_BITRATE_FACTOR[codec] ?? 1.0;
    return {
      ...info,
      video_codec: CODEC_NAME[codec] ?? "h264",
      // H.265/VP9 при том же качестве дают меньший битрейт → меньше файл (оценка, N-010)
      video_bitrate:
        info.video_bitrate != null ? Math.round(info.video_bitrate * factor) : info.video_bitrate,
    };
  },
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
