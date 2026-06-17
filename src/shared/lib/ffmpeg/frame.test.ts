// Тесты извлечения vf-цепочки для превью-кадра «После». См. frame.ts.
import { describe, it, expect } from "vitest";
import { videoFilterChain, previewPlan } from "./frame";
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

describe("previewPlan", () => {
  it("линейный граф → план vf (простая строка)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "out")],
    };
    const plan = previewPlan(graph, new Map([["in", "input.mp4"]]));
    expect(plan).toEqual({ kind: "vf", vf: "scale=640:-2" });
  });

  it("GIF (merge) → план complex с filter_complex и mapVideo", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("g", "filter", "to_gif", { fps: 12, width: 480 }),
        node("out", "output"),
      ],
      edges: [edge("in", "g"), edge("g", "out")],
    };
    const plan = previewPlan(graph, new Map([["in", "input.mp4"]]));
    expect(plan?.kind).toBe("complex");
    if (plan?.kind !== "complex") return;
    expect(plan.spec.inputs).toEqual(["input.mp4"]);
    expect(plan.spec.filterComplex).toContain("palettegen");
    expect(plan.spec.mapVideo).toBe("v1");
  });

  it("overlay (два входа) → complex с двумя inputs", () => {
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("ov", "filter", "overlay", { x: 0, y: 0 }),
        node("out", "output"),
      ],
      edges: [
        edge("in1", "ov", "in-0"),
        edge("in2", "ov", "in-1"),
        edge("ov", "out"),
      ],
    };
    const plan = previewPlan(
      graph,
      new Map([
        ["in1", "main.mp4"],
        ["in2", "logo.png"],
      ]),
    );
    expect(plan?.kind).toBe("complex");
    if (plan?.kind !== "complex") return;
    expect(plan.spec.inputs).toEqual(["main.mp4", "logo.png"]);
    expect(plan.spec.filterComplex).toContain("overlay");
  });

  it("оборванный DAG → null", () => {
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("ov", "filter", "overlay", { x: 0, y: 0 }),
        node("out", "output"),
      ],
      edges: [edge("in1", "ov", "in-0")], // нет второго входа и нет ov→out
    };
    expect(previewPlan(graph, new Map([["in1", "main.mp4"]]))).toBeNull();
  });
});
