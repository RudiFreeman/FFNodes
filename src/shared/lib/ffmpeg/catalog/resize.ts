// Категория «Размер / FPS» — фильтры, меняющие геометрию и частоту кадров.
import type { FilterDef } from "./types";

const CATEGORY = "Размер / FPS";

// Изменить разрешение видео
export const scale: FilterDef = {
  id: "scale",
  category: CATEGORY,
  label: "Изменить размер",
  description:
    "Меняет разрешение видео. Зачем: уменьшить файл, подогнать под платформу " +
    "(например 1080p → 720p) или соцсеть. Высота -2 сохраняет пропорции.",
  params: [
    { id: "width", label: "Ширина", type: "number", default: 1280, hint: "в пикселях" },
    {
      id: "height",
      label: "Высота",
      type: "number",
      default: -2,
      hint: "-2 = авто по пропорциям",
    },
  ],
  toCommand: (p) => ({ vf: `scale=${p.width}:${p.height}` }),
  // Разрешение. -1/-2 = авто по пропорциям: считаем от текущих размеров входа.
  applyToInfo: (info, p) => {
    const w = Number(p.width);
    const h = Number(p.height);
    const auto = (v: number) => v === -1 || v === -2;
    // Если одна сторона авто — пересчитываем её по соотношению сторон входа
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
  },
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
  applyToInfo: (info, p) => ({ ...info, fps: Number(p.value) }),
};
