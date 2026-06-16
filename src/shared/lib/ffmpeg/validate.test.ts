// Тесты валидации несочетаемых операций (N-007).
import { describe, it, expect } from "vitest";
import { validateGraph } from "./validate";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";

const node = (id: string, kind: GraphNode["kind"], filterId?: string, params = {}): GraphNode => ({
  id,
  kind,
  filterId,
  params,
  position: { x: 0, y: 0 },
});
const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

// Линейный граф input → [фильтры по порядку] → output
const chain = (...filters: GraphNode[]): Graph => {
  const nodes = [node("in", "input"), ...filters, node("out", "output")];
  const ids = ["in", ...filters.map((f) => f.id), "out"];
  const edges: GraphEdge[] = [];
  for (let i = 0; i < ids.length - 1; i++) edges.push(edge(ids[i], ids[i + 1]));
  return { nodes, edges };
};

describe("validateGraph — несочетаемые операции", () => {
  it("«Извлечь аудио» (-vn) + видеофильтр → ошибка, обе ноды помечены", () => {
    const g = chain(
      node("a", "filter", "extract_audio"),
      node("b", "filter", "scale", { width: 1280, height: -2 }),
    );
    const { errors } = validateGraph(g);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("видео");
    expect(errors[0].nodeIds).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("«Извлечь аудио» (-vn) + «Сжать видео» (-c:v) → ошибка (compress нужен видеопоток)", () => {
    const g = chain(
      node("a", "filter", "extract_audio"),
      node("b", "filter", "compress", { crf: 23 }),
    );
    expect(validateGraph(g).errors).toHaveLength(1);
  });

  it("«Извлечь аудио» (-vn) + «Убрать звук» (-an) → ошибка про пустой файл", () => {
    const g = chain(
      node("a", "filter", "extract_audio"),
      node("b", "filter", "remove_audio"),
    );
    const { errors } = validateGraph(g);
    // Сработают оба правила (видео+видеофильтра нет, но -vn и -an конфликтуют как пустой файл)
    const pustoy = errors.find((e) => e.message.includes("пустой"));
    expect(pustoy).toBeDefined();
    expect(pustoy!.nodeIds).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("валидная цепочка (только видеофильтры) → нет ошибок", () => {
    const g = chain(
      node("a", "filter", "scale", { width: 1280, height: -2 }),
      node("b", "filter", "fps", { value: 30 }),
    );
    expect(validateGraph(g).errors).toEqual([]);
  });

  it("только «Убрать звук» (-an) → нет ошибок (видео остаётся)", () => {
    const g = chain(node("a", "filter", "remove_audio"));
    expect(validateGraph(g).errors).toEqual([]);
  });

  it("только «Извлечь аудио» (-vn) без видеофильтров → нет ошибок", () => {
    const g = chain(node("a", "filter", "extract_audio"));
    expect(validateGraph(g).errors).toEqual([]);
  });

  it("разорванная цепочка → валидатор молчит (этим займётся генератор)", () => {
    // input и output без связи между ними
    const g: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "extract_audio"), node("out", "output")],
      edges: [edge("in", "a")], // нет a→out
    };
    expect(validateGraph(g).errors).toEqual([]);
  });

  it("пустая цепочка input→output → нет ошибок", () => {
    const g: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(validateGraph(g).errors).toEqual([]);
  });
});
