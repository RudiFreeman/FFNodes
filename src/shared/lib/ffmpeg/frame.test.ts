// Тесты извлечения vf-цепочки для превью-кадра «После». См. frame.ts.
import { describe, it, expect } from "vitest";
import { videoFilterChain } from "./frame";
import type { Graph, GraphNode, GraphEdge, ParamValue } from "../../types/graph";

const node = (
  id: string,
  kind: GraphNode["kind"],
  filterId?: string,
  params: Record<string, ParamValue> = {},
): GraphNode => ({ id, kind, filterId, params, position: { x: 0, y: 0 } });

const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("videoFilterChain", () => {
  it("собирает vf-фрагменты в порядке цепочки", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
        node("b", "filter", "fps", { value: 15 }),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "out")],
    };
    expect(videoFilterChain(graph)).toBe("scale=640:-2,fps=15");
  });

  it("нет видеофильтров (только кодек-опции) → пустая строка", () => {
    // crf даёт outputArgs, но не vf — для кадра он не нужен
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("c", "filter", "compress", { crf: 23 }),
        node("out", "output"),
      ],
      edges: [edge("in", "c"), edge("c", "out")],
    };
    expect(videoFilterChain(graph)).toBe("");
  });

  it("input → output без фильтров → пустая строка", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(videoFilterChain(graph)).toBe("");
  });

  it("оборванная цепочка → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }), node("out", "output")],
      edges: [edge("in", "a")], // a → out нет
    };
    expect(videoFilterChain(graph)).toBeNull();
  });

  it("неизвестный фильтр → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("x", "filter", "no-such-filter"), node("out", "output")],
      edges: [edge("in", "x"), edge("x", "out")],
    };
    expect(videoFilterChain(graph)).toBeNull();
  });
});
