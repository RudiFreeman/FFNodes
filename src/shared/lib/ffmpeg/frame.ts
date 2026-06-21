// Извлечение vf-цепочки из графа для превью-кадра «После».
// Чистая функция, переиспользует обход цепочки (chain.ts) и вклад операций (toCommand).
// В отличие от generate.ts здесь нужны ТОЛЬКО видеофильтры (-vf): кодек/контейнер-опции
// (outputArgs) для одного JPEG-кадра не нужны. См. docs/ARCHITECTURE.md §4.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";
import { isLinearGraph, topoSort, outputNodes } from "./dag";
import { buildComplexPlan, buildMultiOutputPlan } from "./complex/build";
import { isComplexError } from "./complex/types";

// Собрать строку -vf из графа: фрагменты фильтров через запятую (порядок цепочки).
// Возвращает:
//   - строку фильтров (напр. "scale=640:-1,hflip"), если цепочка цела и в ней есть vf;
//   - "" (пустая строка), если цепочка цела, но видеофильтров нет (кадр = исходник);
//   - null, если цепочка разорвана/неполна (кадр «После» строить не из чего).
export function videoFilterChain(graph: Graph): string | null {
  const ordered = orderedFilters(graph);
  if (ordered === null) return null;

  const parts: string[] = [];
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) return null; // неизвестный фильтр — не строим кадр
    const contrib = def.toCommand(node.params);
    if (contrib.vf) parts.push(contrib.vf);
  }
  return parts.join(",");
}

// Спецификация кадра «После» для DAG-графа (filter_complex, несколько входов).
// Используется, когда граф НЕ линейный (merge-операции/несколько входов): простой -vf
// не годится. inputs — пути входов в порядке -i; filterComplex — тело; mapVideo — лейбл
// видеопотока для -map. null — граф не собран (кадр «После» строить не из чего).
export interface PreviewComplexSpec {
  inputs: string[];
  filterComplex: string;
  mapVideo: string | null;
}

// Какой способ строить кадр «После» нужен для данного графа.
//   { kind: "vf", vf }       — линейный граф: простая -vf строка (vf может быть "");
//   { kind: "complex", spec } — DAG: filter_complex с несколькими входами;
//   null                      — граф не собран.
export type PreviewPlan =
  | { kind: "vf"; vf: string }
  | { kind: "complex"; spec: PreviewComplexSpec }
  | null;

// Решить, как строить кадр «После». inputPaths — пути входных нод (id → path) для DAG.
// outputNodeId — для какого выхода кадр (мульти-аутпут: у выходов разные ветки); не задан —
// первый выход (обратная совместимость с одиночным выходом).
export function previewPlan(
  graph: Graph,
  inputPaths: Map<string, string>,
  outputNodeId?: string,
): PreviewPlan {
  // Мульти-аутпут: кадр «После» выбранного выхода — его ветка filter_complex + его mapVideo.
  if (outputNodes(graph).length > 1) {
    const plan = buildMultiOutputPlan(graph, inputPaths);
    if (isComplexError(plan)) return null;
    const target = outputNodeId
      ? plan.outputs.find((o) => o.nodeId === outputNodeId)
      : plan.outputs[0];
    if (!target) return null;
    return {
      kind: "complex",
      spec: { inputs: plan.inputs, filterComplex: plan.filterComplex, mapVideo: target.mapVideo },
    };
  }

  if (isLinearGraph(graph)) {
    const vf = videoFilterChain(graph);
    return vf === null ? null : { kind: "vf", vf };
  }
  // DAG (одиночный выход): план filter_complex (тот же, что для рендера, без outputArgs-кодеков)
  const plan = buildComplexPlan(graph, inputPaths);
  if (isComplexError(plan)) return null;
  return {
    kind: "complex",
    spec: { inputs: plan.inputs, filterComplex: plan.filterComplex, mapVideo: plan.mapVideo },
  };
}

// Момент (сек) для кадра «После» с учётом обрезки по времени (N-012). trim в -vf не
// перематывает таймстемпы к нулю: после trim=start=S:end=E кадры сохраняют исходную шкалу
// [S, E]. Кадр на середине исходника (duration/2) может оказаться ВНЕ этого диапазона —
// ffmpeg вернёт кадр не из результата (или пустой). Поэтому при наличии trim берём середину
// его диапазона. Берём ПЕРВУЮ trim-ноду в топо-порядке (последовательные trim — редкий край).
// Без trim — середина исходника (duration/2), как было. Чистая функция.
export function previewMoment(graph: Graph, duration: number | null): number {
  const fallback = duration && duration > 0 ? duration / 2 : 0;
  const ordered = topoSort(graph);
  if (ordered === null) return fallback;

  for (const node of ordered) {
    if (node.kind !== "filter" || node.filterId !== "trim") continue;
    const start = Number(node.params.start);
    const end = Number(node.params.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    // Середина диапазона trim, подрезанная к длительности исходника (если известна)
    const mid = (start + end) / 2;
    return duration && duration > 0 ? Math.min(mid, duration) : mid;
  }
  return fallback;
}
