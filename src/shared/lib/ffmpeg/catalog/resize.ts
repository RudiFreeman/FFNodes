// Категория «Размер / FPS» — фильтры, меняющие геометрию и частоту кадров.
import type { FilterDef } from "./types";
import type { MediaInfo } from "../../../types/media";
import type { ParamValue } from "../../../types/graph";

const CATEGORY = "Размер / FPS";

// Пресеты по КОРОТКОЙ стороне (как привычные «720p/1080p»): число = высота для
// горизонтального видео и ширина для вертикального. Так 720p → 1280×720 (гориз) и
// 720×1280 (верт). N-006: фиксированная ширина 1280 раздувала вертикаль — здесь нет,
// пресет всегда уменьшает (или оставляет) короткую сторону до N, длинную — по пропорциям.
const PRESET_1080 = "1080p";
const PRESET_720 = "720p";
const PRESET_480 = "480p";
const PRESET_HALF = "Половина";
const PRESET_CUSTOM = "Свои размеры";

// Короткая сторона пресета в пикселях
const SHORT_SIDE: Record<string, number> = {
  [PRESET_1080]: 1080,
  [PRESET_720]: 720,
  [PRESET_480]: 480,
};

// Чёт-безопасное уменьшение до целого (H.264 требует чётные размеры)
const even = (v: number) => Math.round(v / 2) * 2;

// Изменить разрешение видео
export const scale: FilterDef = {
  id: "scale",
  category: CATEGORY,
  label: "Изменить размер",
  description:
    "Меняет разрешение видео. Зачем: уменьшить файл, подогнать под платформу " +
    "(например 1080p → 720p) или соцсеть. Пресеты как привычные «720p/1080p»: " +
    "720p → 1280×720 для горизонтального и 720×1280 для вертикального видео.",
  params: [
    {
      id: "preset",
      label: "Пресет",
      type: "enum",
      default: PRESET_1080,
      options: [PRESET_1080, PRESET_720, PRESET_480, PRESET_HALF, PRESET_CUSTOM],
    },
    // Свои размеры — видны только при пресете «Свои размеры»
    {
      id: "width",
      label: "Ширина",
      type: "number",
      default: 1280,
      hint: "в пикселях",
      showIf: { param: "preset", equals: PRESET_CUSTOM },
    },
    {
      id: "height",
      label: "Высота",
      type: "number",
      default: -2,
      hint: "-2 = авто по пропорциям",
      showIf: { param: "preset", equals: PRESET_CUSTOM },
    },
  ],
  toCommand: (p) => ({ vf: scaleFilter(p) }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
  applyToInfo: (info, p) => applyScale(info, p),
};

// Собрать выражение scale=... по пресету
function scaleFilter(p: Record<string, ParamValue>): string {
  const preset = String(p.preset ?? PRESET_1080);
  if (preset === PRESET_CUSTOM) {
    return `scale=${p.width}:${p.height}`;
  }
  if (preset === PRESET_HALF) {
    // Половина: чёт-безопасно (trunc до чётного через -2 от деления выражением)
    return "scale=trunc(iw/4)*2:trunc(ih/4)*2";
  }
  const n = SHORT_SIDE[preset];
  if (n === undefined) return `scale=${p.width}:${p.height}`;
  // По короткой стороне. ВАЖНО: спец-значение -2 («авто, кратно 2») работает только когда
  // ВЕСЬ параметр = "-2"; внутри if()-выражения -2 трактуется буквально (−2 пикселя → ошибка).
  // Поэтому вторую сторону считаем арифметикой и округляем до чётного: round(x/2)*2.
  // Гориз (iw>ih): высота=N, ширина = iw*N/ih (чётн.); иначе: ширина=N, высота = ih*N/iw (чётн.).
  // Запятые внутри if(gt(...)) экранируем (\\,) — иначе ffmpeg примет их за разделитель фильтров.
  const w = `if(gt(iw\\,ih)\\,round(iw*${n}/ih/2)*2\\,${n})`;
  const h = `if(gt(iw\\,ih)\\,${n}\\,round(ih*${n}/iw/2)*2)`;
  return `scale=w=${w}:h=${h}`;
}

// Пересчитать характеристики «После» под выбранный пресет
function applyScale(info: MediaInfo, p: Record<string, ParamValue>): MediaInfo {
  const preset = String(p.preset ?? PRESET_1080);

  if (preset === PRESET_CUSTOM) {
    const w = Number(p.width);
    const h = Number(p.height);
    const auto = (v: number) => v === -1 || v === -2;
    let outW = w;
    let outH = h;
    if (auto(w) && !auto(h) && info.width && info.height) {
      outW = Math.round((info.width / info.height) * h);
    } else if (auto(h) && !auto(w) && info.width && info.height) {
      outH = Math.round((info.height / info.width) * w);
    }
    return {
      ...info,
      width: auto(outW) ? info.width : outW,
      height: auto(outH) ? info.height : outH,
    };
  }

  // Без размеров входа предсказать не можем — оставляем как есть
  if (!info.width || !info.height) return { ...info };

  if (preset === PRESET_HALF) {
    return { ...info, width: even(info.width / 2), height: even(info.height / 2) };
  }

  const n = SHORT_SIDE[preset];
  if (n === undefined) return { ...info };
  const horizontal = info.width > info.height;
  if (horizontal) {
    // Гориз: высота = N (короткая), ширина по пропорции
    const outH = n;
    const outW = even((info.width / info.height) * n);
    return { ...info, width: outW, height: outH };
  }
  // Верт/квадрат: ширина = N (короткая), высота по пропорции
  const outW = n;
  const outH = even((info.height / info.width) * n);
  return { ...info, width: outW, height: outH };
}

// Добавить чёрные поля до целевого размера (леттербокс/паддинг, фильтр pad).
// Исходный кадр центрируется, вокруг — чёрные поля. НЕ масштабирует (для этого «Изменить
// размер»); если цель меньше исходника — pad ничего не обрежет, поэтому цель должна быть ≥ входа.
export const pad: FilterDef = {
  id: "pad",
  category: CATEGORY,
  label: "Отступы / леттербокс",
  description:
    "Добавляет чёрные поля вокруг кадра до целевого размера (фильтр pad), кадр по центру. " +
    "Зачем: вписать видео в нужный формат без растяжения (например горизонтальное в " +
    "квадрат 1080×1080 для соцсети). Целевой размер должен быть не меньше исходного.",
  params: [
    { id: "width", label: "Ширина", type: "number", default: 1080, hint: "в пикселях, ≥ ширины входа" },
    { id: "height", label: "Высота", type: "number", default: 1080, hint: "в пикселях, ≥ высоты входа" },
  ],
  // Кадр центрируется: смещение = (целевая − исходная)/2 по каждой оси
  toCommand: (p) => ({ vf: `pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
  applyToInfo: (info, p) => ({ ...info, width: Number(p.width), height: Number(p.height) }),
};

// Сменить частоту кадров
export const fps: FilterDef = {
  id: "fps",
  category: CATEGORY,
  label: "Сменить частоту кадров",
  description:
    "Задаёт число кадров в секунду (FPS). Зачем: уменьшить вес (например для GIF " +
    "хватает 10–15 fps) или привести к стандарту (24/30/60).",
  params: [
    { id: "value", label: "Кадров в секунду", type: "number", default: 30 },
  ],
  toCommand: (p) => ({ vf: `fps=${p.value}` }),
  streams: { needsVideo: true }, // видеофильтр — нужен видеопоток
  applyToInfo: (info, p) => ({ ...info, fps: Number(p.value) }),
};
