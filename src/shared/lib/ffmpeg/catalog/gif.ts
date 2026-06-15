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
};
