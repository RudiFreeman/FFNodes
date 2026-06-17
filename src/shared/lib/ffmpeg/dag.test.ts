// Тесты обхода DAG и классификатора линейности (dag.ts).
// Линейные кейсы должны совпадать с orderedFilters (chain.ts) по составу/порядку фильтров.
import { describe, it, expect } from "vitest";
import { topoSort, isLinearGraph, incomingEdges, outgoingEdges } from "./dag";
import { orderedFilters } from "./chain";
import type { Graph, GraphNode, GraphEdge, ParamValue } from "../../types/graph";

const node = (
  id: string,
  kind: GraphNode["kind"],
  filterId?: string,
  params: Record<string, ParamValue> = {},
): GraphNode => ({ id, kind, filterId, params, position: { x: 0, y: 0 } });

const edge = (source: string, target: string, targetHandle?: string): GraphEdge => ({
  id: `${source}-${target}${targetHandle ? `-${targetHandle}` : ""}`,
  source,
  target,
  targetHandle,
});

describe("topoSort", () => {
  it("линейный граф: порядок фильтров совпадает с orderedFilters", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale"),
        node("b", "filter", "fps"),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "out")],
    };
    const topo = topoSort(graph);
    expect(topo).not.toBeNull();
    const topoFilters = topo!.filter((n) => n.kind === "filter").map((n) => n.id);
    const linFilters = orderedFilters(graph)!.map((n) => n.id);
    expect(topoFilters).toEqual(linFilters);
  });

  it("включает все ноды графа (input, фильтры, output)", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "a"), edge("a", "out")],
    };
    const ids = topoSort(graph)!.map((n) => n.id);
    expect(ids).toContain("in");
    expect(ids).toContain("a");
    expect(ids).toContain("out");
    expect(ids).toHaveLength(3);
  });

  it("ветвление (split): один источник → два преемника → output", () => {
    // in → a; in → b; a → out; b → out (ромб)
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale"),
        node("b", "filter", "fps"),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("in", "b"), edge("a", "out"), edge("b", "out")],
    };
    const topo = topoSort(graph);
    expect(topo).not.toBeNull();
    // input идёт раньше своих преемников, output — последним
    const order = topo!.map((n) => n.id);
    expect(order.indexOf("in")).toBeLessThan(order.indexOf("a"));
    expect(order.indexOf("in")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("out"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("out"));
  });

  it("два входа сходятся в merge-ноду (concat-топология)", () => {
    // in1 → m; in2 → m; m → out
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("m", "filter", "concat"),
        node("out", "output"),
      ],
      edges: [edge("in1", "m", "in-a"), edge("in2", "m", "in-b"), edge("m", "out")],
    };
    const topo = topoSort(graph);
    expect(topo).not.toBeNull();
    const order = topo!.map((n) => n.id);
    expect(order.indexOf("in1")).toBeLessThan(order.indexOf("m"));
    expect(order.indexOf("in2")).toBeLessThan(order.indexOf("m"));
    expect(order.indexOf("m")).toBeLessThan(order.indexOf("out"));
  });

  it("цикл → null", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale"),
        node("b", "filter", "fps"),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "a"), edge("b", "out")],
    };
    expect(topoSort(graph)).toBeNull();
  });

  it("оборванная цепочка (фильтр не ведёт к output) → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "a")], // a → out нет, output недостижим
    };
    expect(topoSort(graph)).toBeNull();
  });

  it("нет output → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale")],
      edges: [edge("in", "a")],
    };
    expect(topoSort(graph)).toBeNull();
  });

  it("нет input → null", () => {
    const graph: Graph = {
      nodes: [node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("a", "out")],
    };
    expect(topoSort(graph)).toBeNull();
  });

  it("один из двух входов не доходит до output → null", () => {
    // in1 → out; in2 висит (его ветка не ведёт к output)
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("a", "filter", "scale"),
        node("out", "output"),
      ],
      edges: [edge("in1", "out"), edge("in2", "a")], // a → out нет
    };
    expect(topoSort(graph)).toBeNull();
  });
});

describe("isLinearGraph", () => {
  it("линейная цепочка input→filter→output → true", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "a"), edge("a", "out")],
    };
    expect(isLinearGraph(graph)).toBe(true);
  });

  it("пустая цепочка input→output → true", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(isLinearGraph(graph)).toBe(true);
  });

  it("два входа → false", () => {
    const graph: Graph = {
      nodes: [node("in1", "input"), node("in2", "input"), node("out", "output")],
      edges: [edge("in1", "out"), edge("in2", "out")],
    };
    expect(isLinearGraph(graph)).toBe(false);
  });

  it("ветвление (нода с двумя исходящими) → false", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale"),
        node("b", "filter", "fps"),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("in", "b"), edge("a", "out"), edge("b", "out")],
    };
    expect(isLinearGraph(graph)).toBe(false);
  });

  it("слияние (нода с двумя входящими) → false", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("m", "filter", "scale"), node("out", "output")],
      // искусственно два ребра в m
      edges: [edge("in", "m"), edge("in", "m", "dup"), edge("m", "out")],
    };
    expect(isLinearGraph(graph)).toBe(false);
  });

  // Ветка «нода с def.merge → false» проверяется в Фазе 4/5, когда появятся
  // merge-операции в каталоге (to_gif с палитрой, overlay, concat).
});

describe("incomingEdges / outgoingEdges", () => {
  const graph: Graph = {
    nodes: [
      node("in1", "input"),
      node("in2", "input"),
      node("m", "filter", "concat"),
      node("out", "output"),
    ],
    edges: [edge("in1", "m", "in-a"), edge("in2", "m", "in-b"), edge("m", "out")],
  };

  it("incomingEdges: два входящих у merge-ноды", () => {
    expect(incomingEdges(graph, "m")).toHaveLength(2);
    expect(incomingEdges(graph, "in1")).toHaveLength(0);
  });

  it("outgoingEdges: один исходящий у merge-ноды", () => {
    expect(outgoingEdges(graph, "m")).toHaveLength(1);
    expect(outgoingEdges(graph, "in1")).toHaveLength(1);
  });
});
