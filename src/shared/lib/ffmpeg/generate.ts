// Генерация FFmpeg-команды из графа. Сердце проекта — чистая функция без побочных эффектов.
// См. docs/ARCHITECTURE.md §4. MVP: линейная цепочка input → filter… → output, опция -vf.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";
import { isLinearGraph, outputNodes } from "./dag";
import { buildComplexPlan, buildMultiOutputPlan } from "./complex/build";
import { isComplexError } from "./complex/types";
import { validateGraph } from "./validate";

export interface GeneratedCommand {
  args: string[]; // аргументы для запуска (НЕ склеенная строка — защита от инъекций)
  display: string; // человекочитаемая команда для показа внизу
  error?: string; // если граф неполон/несочетаем — что именно не так (команду не строим)
  invalidNodeIds?: string[]; // ноды-виновники ошибки валидации (для подсветки на холсте)
  // Мульти-аутпут (Спринт 3): плейсхолдеры выходных файлов в args (output_0, output_1…),
  // в порядке выходных секций. useRender спросит save-диалог на каждый и заменит по индексу.
  // Для одиночного выхода — один элемент (PLACEHOLDER_OUTPUT), как было.
  outputPlaceholders?: string[];
}

const PLACEHOLDER_INPUT = "input.mp4";
const PLACEHOLDER_OUTPUT = "output.mp4";
// Плейсхолдер выходного файла N-го выхода (мульти-аутпут). Фронт заменит на реальный путь.
const outputPlaceholder = (i: number) => `output_${i}.mp4`;

// Имя файла из пути для читаемого display (кроссплатформенно). Логика дублирует
// shared/lib/format.basename, но generate.ts — чистый модуль без зависимостей от UI-утилит.
function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

// Порядок цепочки фильтров (input→output) — общая логика в chain.ts.

// inputPath — реальный путь выбранного файла; если не задан, используется плейсхолдер.
// Линейный граф идёт простым -vf/-af путём (как раньше); DAG (merge-операции, несколько
// входов, ветвление) — через -filter_complex. Граница — isLinearGraph (см. dag.ts).
export function generateCommand(graph: Graph, inputPath?: string): GeneratedCommand {
  // Мульти-аутпут (Спринт 3, Вариант A): несколько выходов — одна команда с N выходными
  // секциями (-map … out_i). Декод входа один, ветвление через split (см. complex/build).
  if (outputNodes(graph).length > 1) {
    return generateMultiOutputCommand(graph, inputPath);
  }

  if (!isLinearGraph(graph)) {
    return generateComplexCommand(graph, inputPath);
  }

  const ordered = orderedFilters(graph);

  if (ordered === null) {
    return {
      args: [],
      display: "",
      error: "Соедини ноды: вход → фильтры → выход",
    };
  }

  // Цепочка цела — проверяем осмысленность комбинации операций (N-007).
  // Несочетаемые операции блокируют рендер с понятным объяснением.
  const { errors } = validateGraph(graph);
  if (errors.length > 0) {
    return {
      args: [],
      display: "",
      error: errors[0].message,
      invalidNodeIds: errors.flatMap((e) => e.nodeIds),
    };
  }

  // Для args — полный путь (запуск); для display — короткое имя файла (читаемость)
  const inputForArgs = inputPath ?? PLACEHOLDER_INPUT;
  const inputForDisplay = inputPath ? fileName(inputPath) : PLACEHOLDER_INPUT;

  // Собрать вклад каждой ноды: vf/af-фрагменты в цепочки + выходные опции-флаги
  const filterStrings: string[] = [];
  const audioFilterStrings: string[] = [];
  const outputArgs: string[] = [];
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) {
      return { args: [], display: "", error: `Неизвестный фильтр: ${node.filterId}` };
    }
    const contrib = def.toCommand(node.params);
    if (contrib.vf) filterStrings.push(contrib.vf);
    if (contrib.af) audioFilterStrings.push(contrib.af);
    if (contrib.outputArgs) outputArgs.push(...contrib.outputArgs);
  }

  // Порядок FFmpeg: вход → -vf → -af → выходные опции → выход
  const args: string[] = ["-i", inputForArgs];
  if (filterStrings.length > 0) args.push("-vf", filterStrings.join(","));
  if (audioFilterStrings.length > 0) args.push("-af", audioFilterStrings.join(","));
  args.push(...outputArgs);
  args.push(PLACEHOLDER_OUTPUT);

  // display — для чтения (vf/af-цепочки в кавычках)
  const parts = ["ffmpeg", "-i", inputForDisplay];
  if (filterStrings.length > 0) parts.push("-vf", `"${filterStrings.join(",")}"`);
  if (audioFilterStrings.length > 0) parts.push("-af", `"${audioFilterStrings.join(",")}"`);
  parts.push(...outputArgs);
  parts.push(PLACEHOLDER_OUTPUT);

  return { args, display: parts.join(" "), outputPlaceholders: [PLACEHOLDER_OUTPUT] };
}

// Сборка команды через -filter_complex для DAG-графа (merge-операции, несколько входов).
// Карта входов: каждой input-ноде сопоставляется путь. Пока единственный inputPath раздаётся
// первому входу; полная привязка путей к нодам появится с multi-input UI (Фаза 3).
function generateComplexCommand(graph: Graph, inputPath?: string): GeneratedCommand {
  const inputNodes = graph.nodes.filter((n) => n.kind === "input");
  const inputPaths = new Map<string, string>();
  inputNodes.forEach((n, i) => {
    // путь ноды берётся из её params (Фаза 3); fallback — переданный inputPath для первого
    const fromParams = typeof n.params.path === "string" ? n.params.path : undefined;
    inputPaths.set(n.id, fromParams ?? (i === 0 ? inputPath ?? PLACEHOLDER_INPUT : PLACEHOLDER_INPUT));
  });

  const plan = buildComplexPlan(graph, inputPaths);
  if (isComplexError(plan)) {
    return { args: [], display: "", error: plan.error, invalidNodeIds: plan.invalidNodeIds };
  }

  // args: каждый вход -i; затем -filter_complex; -map видео (+аудио); outputArgs; выход.
  const args: string[] = [];
  for (const p of plan.inputs) args.push("-i", p);
  if (plan.filterComplex) args.push("-filter_complex", plan.filterComplex);
  if (plan.mapVideo) args.push("-map", refLabel(plan.mapVideo));
  if (plan.mapAudio) args.push("-map", refLabel(plan.mapAudio));
  args.push(...plan.outputArgs);
  args.push(PLACEHOLDER_OUTPUT);

  // display — читаемый вид: короткие имена входов, filter_complex в кавычках
  const parts = ["ffmpeg"];
  for (const p of plan.inputs) parts.push("-i", fileName(p));
  if (plan.filterComplex) parts.push("-filter_complex", `"${plan.filterComplex}"`);
  if (plan.mapVideo) parts.push("-map", refLabel(plan.mapVideo));
  if (plan.mapAudio) parts.push("-map", refLabel(plan.mapAudio));
  parts.push(...plan.outputArgs);
  parts.push(PLACEHOLDER_OUTPUT);

  return { args, display: parts.join(" "), outputPlaceholders: [PLACEHOLDER_OUTPUT] };
}

// Сборка команды мульти-аутпута (Вариант A): один вход → N выходов одной командой.
// -i … -filter_complex "…" (-map vN [-map aN] outputArgs_N OUT_N)×N. Один декод входа,
// каждый выход — своя секция. Плейсхолдеры выходов (output_0.mp4…) фронт заменит на пути.
function generateMultiOutputCommand(graph: Graph, inputPath?: string): GeneratedCommand {
  const inputNodes = graph.nodes.filter((n) => n.kind === "input");
  const inputPaths = new Map<string, string>();
  inputNodes.forEach((n, i) => {
    const fromParams = typeof n.params.path === "string" ? n.params.path : undefined;
    inputPaths.set(n.id, fromParams ?? (i === 0 ? inputPath ?? PLACEHOLDER_INPUT : PLACEHOLDER_INPUT));
  });

  const plan = buildMultiOutputPlan(graph, inputPaths);
  if (isComplexError(plan)) {
    return { args: [], display: "", error: plan.error, invalidNodeIds: plan.invalidNodeIds };
  }

  const placeholders = plan.outputs.map((_, i) => outputPlaceholder(i));

  // args: входы → общий -filter_complex → по секции на каждый выход
  const args: string[] = [];
  for (const p of plan.inputs) args.push("-i", p);
  if (plan.filterComplex) args.push("-filter_complex", plan.filterComplex);
  plan.outputs.forEach((o, i) => {
    if (o.mapVideo) args.push("-map", refLabel(o.mapVideo));
    if (o.mapAudio) args.push("-map", refLabel(o.mapAudio));
    args.push(...o.outputArgs);
    args.push(placeholders[i]);
  });

  // display — читаемый вид: короткие имена входов, filter_complex в кавычках, секции выходов
  const parts = ["ffmpeg"];
  for (const p of plan.inputs) parts.push("-i", fileName(p));
  if (plan.filterComplex) parts.push("-filter_complex", `"${plan.filterComplex}"`);
  plan.outputs.forEach((o, i) => {
    if (o.mapVideo) parts.push("-map", refLabel(o.mapVideo));
    if (o.mapAudio) parts.push("-map", refLabel(o.mapAudio));
    parts.push(...o.outputArgs);
    parts.push(placeholders[i]);
  });

  return { args, display: parts.join(" "), outputPlaceholders: placeholders };
}

// Ссылка на поток в -map: промежуточные лейблы в скобках ([vout]), входные — как есть (0:v).
// Промежуточный лейбл (от аллокатора) не содержит двоеточия; входной — содержит ("N:v").
function refLabel(label: string): string {
  return label.includes(":") ? label : `[${label}]`;
}
