// Тесты обхода цепочки. Общая логика порядка для generate.ts и predict.ts (см. ARCHITECTURE §4).
import { describe, it, expect } from "vitest";
import { orderedFilters } from "./chain";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";

const node = (id: string, kind: GraphNode["kind"], filterId?: string): GraphNode => ({
  id,
  kind,
  filterId,
  params: {},
  position: { x: 0, y: 0 },
});
const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("orderedFilters", () => {
  it("возвращает фильтры в порядке связей, а не массива нод", () => {
    const graph: Graph = {
      nodes: [node("out", "output"), node("b", "filter", "fps"), node("a", "filter", "scale"), node("in", "input")],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "out")],
    };
    expect(orderedFilters(graph)?.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("input → output без фильтров: пустой массив (цепочка цела)", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(orderedFilters(graph)).toEqual([]);
  });

  it("нет output → null", () => {
    const graph: Graph = { nodes: [node("in", "input")], edges: [] };
    expect(orderedFilters(graph)).toBeNull();
  });

  it("оборванная цепочка → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "a")], // a → out нет
    };
    expect(orderedFilters(graph)).toBeNull();
  });

  it("цикл → null (не зацикливается)", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("b", "filter", "fps"), node("out", "output")],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "a")],
    };
    expect(orderedFilters(graph)).toBeNull();
  });
});
