// Типы каталога фильтров. Каталог — это ДАННЫЕ, а не код. См. docs/ARCHITECTURE.md §3.
// Каждая запись описывает одну FFmpeg-операцию: человеческое имя, описание «что и зачем»,
// параметры и её ВКЛАД в команду (видеофильтр в -vf и/или выходные опции-флаги).
import type { ParamValue } from "../../../types/graph";
import type { MediaInfo } from "../../../types/media";

// Тип параметра — определяет, каким контролом его редактировать
export type ParamType = "number" | "string" | "enum" | "boolean";

// Один параметр фильтра
export interface FilterParam {
  id: string; // 'width', 'fps'…
  label: string; // «Ширина» — человеческое имя
  type: ParamType;
  default?: ParamValue;
  options?: string[]; // для enum
  hint?: string; // helper-текст под полем
  // Условная видимость: параметр показывается, только если другой параметр (`param`)
  // равен `equals`. Напр. поля «Ширина/Высота» видны лишь при пресете «Свои размеры».
  showIf?: { param: string; equals: ParamValue };
}

// Вклад операции в итоговую команду. Гибкий: операция может дать кусок -vf фильтра
// (склеивается в цепочку с другими через запятую) И/ИЛИ выходные опции-флаги (-c:v, -crf, -an…).
export interface CommandContribution {
  vf?: string; // фрагмент видеофильтра, напр. 'scale=1280:-2'
  af?: string; // фрагмент аудиофильтра, напр. 'volume=2.0' (склеивается в -af цепочку)
  outputArgs?: string[]; // флаги выходных опций, напр. ['-c:v', 'libx264', '-crf', '23']
}

// Как операция влияет на потоки — декларативно, для валидации несочетаемых комбинаций
// (см. validate.ts, N-007). Без хардкода id фильтров в валидаторе.
export interface StreamEffect {
  dropsVideo?: boolean; // убирает видеодорожку (-vn, напр. «Извлечь аудио»)
  dropsAudio?: boolean; // убирает аудиодорожку (-an, напр. «Убрать звук»)
  needsVideo?: boolean; // работает по видео (видеофильтр -vf) — бессмыслен без видеопотока
  needsAudio?: boolean; // работает по звуку (аудиофильтр -af) — бессмыслен без аудиопотока
}

// Спецификация merge-операции (слияние/ветвление потоков) — требует filter_complex.
// Наличие merge у FilterDef = «это не простой -vf фильтр»: генератор уходит на
// filter_complex-путь (см. dag.isLinearGraph, complex/build.ts). У 27 single-фильтров
// этого поля нет — они продолжают работать через -vf/-af как раньше.
export interface MergeSpec {
  // Сколько ВНЕШНИХ входных видеопотоков нужно операции:
  //   1 — single-input с внутренним ветвлением (GIF: split→palettegen→paletteuse);
  //   2 — слияние двух источников (overlay, concat).
  videoInputs: number;
  // Сколько входных аудиопотоков задействует операция (concat: 2; overlay: 0/undefined).
  audioInputs?: number;
  // Подписи входов для UI merge-ноды (по одному на видеовход). Порядок = порядок handle
  // (и порядок vIn в toComplex). Напр. overlay: ["Основное видео", "Накладка"]. Если не
  // задано — подписи «Вход 1», «Вход 2»… Handle id формируются как in-0, in-1… (по индексу).
  inputLabels?: string[];
  // Построить фрагмент filter_complex с явными лейблами потоков. Тело фильтра — то же,
  // что в toCommand().vf у обычных операций, но обёрнутое в лейблы снаружи (в build.ts).
  // vIn/aIn — входные лейблы (напр. ["0:v"] или ["v3","1:v"]); vOut/aOut — выходные.
  toComplex: (ctx: {
    vIn: string[];
    aIn: string[];
    vOut: string;
    aOut?: string;
    params: Record<string, ParamValue>;
  }) => string;
  // Предсказание характеристик при слиянии: primary — основной (нижний/первый) поток,
  // secondary — второй вход (null для single-input merge). См. predict.ts (Фаза 6).
  applyMerge?: (
    primary: MediaInfo,
    secondary: MediaInfo | null,
    params: Record<string, ParamValue>,
  ) => MediaInfo;
}

// Определение одной операции/фильтра
export interface FilterDef {
  id: string; // 'scale'
  category: string; // 'Размер / FPS' — для группировки в каталоге
  label: string; // «Изменить размер» — человеческое имя
  description: string; // «Что это и зачем» — ключевая ценность продукта
  params: FilterParam[];
  // Как операция вкладывается в команду из значений параметров.
  toCommand: (p: Record<string, ParamValue>) => CommandContribution;
  // Как операция меняет характеристики медиа — для предсказания «После» (см. predict.ts).
  // Возвращает НОВЫЙ MediaInfo (иммутабельно). Необязательно: операция без этого поля
  // характеристики не меняет (напр. поворот на 180°, цветокоррекция, отражение).
  applyToInfo?: (info: MediaInfo, p: Record<string, ParamValue>) => MediaInfo;
  // Разумные дефолты параметров из метаданных входа (probe_media). Вызывается при ДОБАВЛЕНИИ
  // ноды (см. useGraph.addFilterNode); результат накладывается ПОВЕРХ статичных
  // FilterParam.default. Пример: «Сменить кодек» подставляет текущий кодек входа. Чистая
  // функция «info → частичные параметры». Необязательно: у операции без осмысленного
  // info-дефолта поля нет — берётся статичный default. Возвращай ключ ТОЛЬКО при ненулевом
  // поле info (иначе оставь статичный дефолт), и только значения для выбора кликом.
  defaultsFromInfo?: (info: MediaInfo) => Partial<Record<string, ParamValue>>;
  // Влияние на потоки — для валидации несочетаемых операций (N-007). Необязательно:
  // операция без этого поля считается нейтральной к потокам.
  streams?: StreamEffect;
  // Merge-операция (слияние/ветвление потоков, filter_complex). Необязательно: у обычных
  // single-фильтров его нет — они идут простым -vf/-af путём. См. MergeSpec выше.
  merge?: MergeSpec;
}
