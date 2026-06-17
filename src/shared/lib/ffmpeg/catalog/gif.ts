// Категория «Экспорт GIF» — превратить видео в GIF.
import type { FilterDef } from "./types";

const CATEGORY = "Экспорт GIF";

// Сделать GIF. Качественная двухпроходная палитра через filter_complex (N-008 закрыт):
// один вход ветвится (split) — одна ветка строит оптимальную палитру (palettegen), вторая
// применяет её (paletteuse). Результат заметно чище однопроходного (меньше дизеринга и
// «грязи» в градиентах). Это single-input merge-операция: videoInputs=1, второй -i не нужен.
// Выход — формат gif. См. complex/build.ts, dag.isLinearGraph.
export const toGif: FilterDef = {
  id: "to_gif",
  category: CATEGORY,
  label: "Сделать GIF",
  description:
    "Превращает видео в анимированный GIF с качественной палитрой. Зачем: короткие мемы, " +
    "превью, реакции. Низкий FPS (10–15) и небольшая ширина держат вес GIF разумным.",
  params: [
    { id: "fps", label: "Кадров в секунду", type: "number", default: 12, hint: "10–15 хватает для GIF" },
    { id: "width", label: "Ширина", type: "number", default: 480, hint: "в пикселях, высота авто" },
  ],
  // toCommand отдаёт только outputArgs (-f gif). Само тело фильтра строит merge.toComplex
  // (filter_complex). В линейном -vf пути эта операция не участвует (у неё есть merge).
  toCommand: () => ({
    outputArgs: ["-f", "gif"],
  }),
  // Качественная палитра: масштаб+fps → split на две ветки → palettegen / paletteuse.
  // vIn[0] — входной видеопоток (напр. "0:v"); vOut — выходной лейбл.
  merge: {
    videoInputs: 1,
    toComplex: ({ vIn, vOut, params }) =>
      `[${vIn[0]}]fps=${params.fps},scale=${params.width}:-1:flags=lanczos,split[gs1][gs2];` +
      `[gs1]palettegen[gp];[gs2][gp]paletteuse[${vOut}]`,
  },
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
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
