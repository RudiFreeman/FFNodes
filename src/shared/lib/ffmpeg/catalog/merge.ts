// Категория «Слияние» — операции, объединяющие ДВА входа (multi-input, filter_complex).
// overlay (наложение) и concat (склейка). Требуют второй вход (нода «Вход» + ребро в
// merge-ноду). Тело строит merge.toComplex с лейблами потоков. См. complex/build.ts.
import type { FilterDef } from "./types";

const CATEGORY = "Слияние";

// Наложение второго видео/картинки поверх основного (водяной знак, лого, пикчер-ин-пикчер).
// vIn[0] — основное (нижнее) видео, vIn[1] — накладка (верхнее). Позиция — координаты
// левого верхнего угла накладки. Аудио берётся от основного входа (overlay его не трогает).
export const overlay: FilterDef = {
  id: "overlay",
  category: CATEGORY,
  label: "Наложить поверх",
  description:
    "Накладывает второй файл (видео или картинку) поверх основного: водяной знак, лого, " +
    "плашку. Зачем: брендирование, подписи. Нужен второй вход — добавь его и подключи к «Накладке».",
  params: [
    { id: "x", label: "Отступ слева (X)", type: "number", default: 10, hint: "в пикселях от левого края" },
    { id: "y", label: "Отступ сверху (Y)", type: "number", default: 10, hint: "в пикселях от верхнего края" },
  ],
  // toCommand вклада в обычную команду не даёт — всё тело в merge.toComplex.
  toCommand: () => ({}),
  streams: { needsVideo: true },
  merge: {
    videoInputs: 2,
    // [main][ov]overlay=x:y[vout] — накладка позиционируется по x:y
    toComplex: ({ vIn, vOut, params }) =>
      `[${vIn[0]}][${vIn[1]}]overlay=${params.x}:${params.y}[${vOut}]`,
    // Размер результата = размер основного (нижнего) видео; второй вход не меняет геометрию.
    applyMerge: (primary) => primary,
  },
};

// Склейка двух роликов подряд (concat). vIn[0]+aIn[0] — первый ролик, vIn[1]+aIn[1] — второй.
// Длительность результата = сумма длительностей. Требует совпадения разрешения/fps
// (ffmpeg concat этого ждёт) — пока на ответственности пользователя.
export const concat: FilterDef = {
  id: "concat",
  category: CATEGORY,
  label: "Склеить ролики",
  description:
    "Склеивает два ролика подряд в один. Зачем: собрать нарезку, добавить интро/концовку. " +
    "Нужен второй вход. Лучше, если оба ролика одного разрешения и fps.",
  params: [],
  toCommand: () => ({}),
  streams: { needsVideo: true },
  merge: {
    videoInputs: 2,
    audioInputs: 2,
    // [v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout] — n=2 входа, по 1 видео+аудио на выходе
    toComplex: ({ vIn, aIn, vOut, aOut }) =>
      `[${vIn[0]}][${aIn[0]}][${vIn[1]}][${aIn[1]}]concat=n=2:v=1:a=1[${vOut}][${aOut}]`,
    // Длительность = сумма; остальные характеристики берём от первого ролика.
    applyMerge: (primary, secondary) => ({
      ...primary,
      duration:
        primary.duration != null && secondary?.duration != null
          ? primary.duration + secondary.duration
          : primary.duration,
    }),
  },
};
