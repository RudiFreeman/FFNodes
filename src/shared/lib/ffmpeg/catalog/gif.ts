// Категория «Экспорт GIF» — превратить видео в GIF.
import type { FilterDef } from "./types";

const CATEGORY = "Экспорт GIF";

// Сделать GIF. Упрощённый однопроходный вариант (fps+scale в -vf): рабочий и в рамках
// линейной vf-модели. Качественная двухпроходная палитра (palettegen/paletteuse) требует
// filter_complex — отложено (см. CODE_NOTES N-008). Выход — формат gif.
export const toGif: FilterDef = {
  id: "to_gif",
  category: CATEGORY,
  label: "Сделать GIF",
  description:
    "Превращает видео в анимированный GIF. Зачем: коротких мемы, превью, реакции. " +
    "Низкий FPS (10–15) и небольшая ширина держат вес GIF разумным.",
  params: [
    { id: "fps", label: "Кадров в секунду", type: "number", default: 12, hint: "10–15 хватает для GIF" },
    { id: "width", label: "Ширина", type: "number", default: 480, hint: "в пикселях, высота авто" },
  ],
  toCommand: (p) => ({
    vf: `fps=${p.fps},scale=${p.width}:-1:flags=lanczos`,
    outputArgs: ["-f", "gif"],
  }),
  streams: { needsVideo: true }, // видеофильтр (fps,scale) — нужен видеопоток
  // GIF: формат gif, без звука, своя ширина (высота авто по пропорциям), свой fps
  applyToInfo: (info, p) => {
    const width = Number(p.width);
    const height =
      info.width && info.height
        ? Math.round((info.height / info.width) * width)
        : info.height;
    return {
      ...info,
      format: "gif",
      format_long: "GIF",
      video_codec: "gif",
      video_codec_long: null,
      video_profile: null,
      audio_codec: null,
      audio_codec_long: null,
      audio_bitrate: null,
      audio_sample_rate: null,
      audio_channels: null,
      channel_layout: null,
      sample_fmt: null,
      fps: Number(p.fps),
      width,
      height,
    };
  },
};
