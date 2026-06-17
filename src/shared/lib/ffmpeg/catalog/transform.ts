// Категория «Поворот / Отражение» — геометрические преобразования кадра (видеофильтры).
import type { FilterDef } from "./types";

const CATEGORY = "Поворот / Отражение";

// Повернуть на фиксированный угол (transpose: 1=90° по часовой, 2=90° против)
export const rotate: FilterDef = {
  id: "rotate",
  category: CATEGORY,
  label: "Повернуть",
  description:
    "Поворачивает видео на 90° или 180°. Зачем: исправить неправильную ориентацию " +
    "(видео с телефона снято боком) или развернуть кадр.",
  params: [
    {
      id: "angle",
      label: "Угол",
      type: "enum",
      default: "90° по часовой",
      options: ["90° по часовой", "90° против часовой", "180°"],
    },
  ],
  toCommand: (p) => {
    // transpose=1 — 90° по часовой, =2 — против; 180° = два transpose
    const map: Record<string, string> = {
      "90° по часовой": "transpose=1",
      "90° против часовой": "transpose=2",
      "180°": "transpose=1,transpose=1",
    };
    return { vf: map[String(p.angle)] ?? "transpose=1" };
  },
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
  // Поворот на 90°/270° меняет ширину и высоту местами; 180° — без изменений
  applyToInfo: (info, p) => {
    if (p.angle === "180°") return { ...info };
    return { ...info, width: info.height, height: info.width };
  },
};

// Повернуть на произвольный угол (фильтр rotate, угол в радианах).
// В отличие от ступенчатого «Повернуть» (90°/180°) — любой угол; размер кадра
// сохраняется, углы обрезаются и заполняются чёрным.
export const rotateAngle: FilterDef = {
  id: "rotate_angle",
  category: CATEGORY,
  label: "Повернуть на угол",
  description:
    "Поворачивает кадр на произвольный угол (в градусах). Зачем: выровнять «заваленный» " +
    "горизонт, художественный наклон. Размер кадра не меняется — углы обрезаются и " +
    "заполняются чёрным. Положительный угол — по часовой стрелке.",
  params: [
    {
      id: "degrees",
      label: "Угол (°)",
      type: "number",
      default: 5,
      hint: "положительный — по часовой; для кратных 90° лучше «Повернуть»",
    },
  ],
  // ffmpeg rotate ждёт радианы: градусы*PI/180
  toCommand: (p) => ({ vf: `rotate=${p.degrees}*PI/180` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};

// Отразить (зеркало) по горизонтали или вертикали
export const flip: FilterDef = {
  id: "flip",
  category: CATEGORY,
  label: "Отразить",
  description:
    "Зеркально отражает видео. Зачем: убрать зеркальность фронтальной камеры, " +
    "создать эффект отражения. Горизонталь меняет лево↔право, вертикаль — верх↔низ.",
  params: [
    {
      id: "dir",
      label: "Направление",
      type: "enum",
      default: "Горизонтально",
      options: ["Горизонтально", "Вертикально"],
    },
  ],
  toCommand: (p) => ({
    vf: p.dir === "Вертикально" ? "vflip" : "hflip",
  }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
};
