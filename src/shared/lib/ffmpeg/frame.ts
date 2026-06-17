// Извлечение vf-цепочки из графа для превью-кадра «После».
// Чистая функция, переиспользует обход цепочки (chain.ts) и вклад операций (toCommand).
// В отличие от generate.ts здесь нужны ТОЛЬКО видеофильтры (-vf): кодек/контейнер-опции
// (outputArgs) для одного JPEG-кадра не нужны. См. docs/ARCHITECTURE.md §4.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";
import { isLinearGraph } from "./dag";
import { buildComplexPlan } from "./complex/build";
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
export function previewPlan(graph: Graph, inputPaths: Map<string, string>): PreviewPlan {
  if (isLinearGraph(graph)) {
    const vf = videoFilterChain(graph);
    return vf === null ? null : { kind: "vf", vf };
  }
  // DAG: строим план filter_complex (тот же, что для рендера, но без outputArgs-кодеков)
  const plan = buildComplexPlan(graph, inputPaths);
  if (isComplexError(plan)) return null;
  return {
    kind: "complex",
    spec: { inputs: plan.inputs, filterComplex: plan.filterComplex, mapVideo: plan.mapVideo },
  };
}
