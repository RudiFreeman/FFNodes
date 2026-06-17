// Тесты построителя filter_complex (build.ts). Аллокация лейблов — тончайшее место,
// покрываем плотно. Merge-операции (overlay/concat/gif) появляются в каталоге позже
// (Фазы 4-5) — их end-to-end проверки там; здесь — оборачивание лейблов и топология.
import { describe, it, expect } from "vitest";
import { buildComplexPlan } from "./build";
import { isComplexError } from "./types";
import type { Graph, GraphNode, GraphEdge, ParamValue } from "../../../types/graph";

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

describe("buildComplexPlan — обычные фильтры через filter_complex", () => {
  it("input → scale → output: оборачивает в лейблы [0:v]scale[v1], мапит v1", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f"), edge("f", "out")],
    };
    const r = buildComplexPlan(graph, new Map([["in", "input.mp4"]]));
    expect(isComplexError(r)).toBe(false);
    if (isComplexError(r)) return;
    expect(r.inputs).toEqual(["input.mp4"]);
    expect(r.filterComplex).toBe("[0:v]scale=1280:-2[v1]");
    expect(r.mapVideo).toBe("v1");
  });

  it("два фильтра подряд: свежий лейбл на каждом шаге", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
        node("b", "filter", "fps", { value: 15 }),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "b"), edge("b", "out")],
    };
    const r = buildComplexPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    expect(r.filterComplex).toBe("[0:v]scale=640:-2[v1];[v1]fps=15[v2]");
    expect(r.mapVideo).toBe("v2");
  });

  it("фильтр без vf (только outputArgs) не плодит лейбл, поток проходит насквозь", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("c", "filter", "compress", { crf: 23 }),
        node("out", "output"),
      ],
      edges: [edge("in", "c"), edge("c", "out")],
    };
    const r = buildComplexPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    // compress не даёт vf → filter_complex пуст, видео мапится прямо из входа 0:v
    expect(r.filterComplex).toBe("");
    expect(r.mapVideo).toBe("0:v");
    expect(r.outputArgs).toEqual(["-c:v", "libx264", "-crf", "23"]);
  });

  it("два входа: два пути в inputs в порядке топологии", () => {
    // in1 → a → out; in2 → out (структурно валидно для topoSort)
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 320, height: -2 }),
        node("out", "output"),
      ],
      edges: [edge("in1", "a"), edge("a", "out"), edge("in2", "a", "z-extra")],
    };
    const r = buildComplexPlan(
      graph,
      new Map([
        ["in1", "first.mp4"],
        ["in2", "second.mp4"],
      ]),
    );
    if (isComplexError(r)) throw new Error(r.error);
    expect(r.inputs).toContain("first.mp4");
    expect(r.inputs).toContain("second.mp4");
    expect(r.inputs).toHaveLength(2);
  });
});

describe("buildComplexPlan — merge-операции (overlay/concat)", () => {
  it("overlay: два входа → [0:v][1:v]overlay[v1], мапит v1, аудио основного входа", () => {
    // in1 (основной) → overlay[in-main]; in2 (накладка) → overlay[in-overlay]; overlay → out
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("ov", "filter", "overlay", { x: 10, y: 20 }),
        node("out", "output"),
      ],
      edges: [
        edge("in1", "ov", "in-main"),
        edge("in2", "ov", "in-overlay"),
        edge("ov", "out"),
      ],
    };
    const r = buildComplexPlan(
      graph,
      new Map([
        ["in1", "main.mp4"],
        ["in2", "logo.png"],
      ]),
    );
    if (isComplexError(r)) throw new Error(r.error);
    expect(r.inputs).toEqual(["main.mp4", "logo.png"]);
    expect(r.filterComplex).toBe("[0:v][1:v]overlay=10:20[v1]");
    expect(r.mapVideo).toBe("v1");
  });

  it("concat: два входа → concat=n=2 с видео+аудио выходами", () => {
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("cc", "filter", "concat", {}),
        node("out", "output"),
      ],
      edges: [
        edge("in1", "cc", "in-a"),
        edge("in2", "cc", "in-b"),
        edge("cc", "out"),
      ],
    };
    const r = buildComplexPlan(
      graph,
      new Map([
        ["in1", "first.mp4"],
        ["in2", "second.mp4"],
      ]),
    );
    if (isComplexError(r)) throw new Error(r.error);
    expect(r.filterComplex).toBe("[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v1][a1]");
    expect(r.mapVideo).toBe("v1");
    expect(r.mapAudio).toBe("a1");
  });

  it("overlay с фильтром на основном входе до слияния: scale потом overlay", () => {
    // in1 → scale → overlay[main]; in2 → overlay[overlay]; overlay → out
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("sc", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("ov", "filter", "overlay", { x: 0, y: 0 }),
        node("out", "output"),
      ],
      edges: [
        edge("in1", "sc"),
        edge("sc", "ov", "in-main"),
        edge("in2", "ov", "in-overlay"),
        edge("ov", "out"),
      ],
    };
    const r = buildComplexPlan(
      graph,
      new Map([
        ["in1", "main.mp4"],
        ["in2", "logo.png"],
      ]),
    );
    if (isComplexError(r)) throw new Error(r.error);
    // scale оборачивает 0:v в v1, overlay берёт v1 (основной, по in-main) и 1:v (накладка)
    expect(r.filterComplex).toBe("[0:v]scale=1280:-2[v1];[v1][1:v]overlay=0:0[v2]");
    expect(r.mapVideo).toBe("v2");
  });
});

describe("buildComplexPlan — ошибки", () => {
  it("вход без выбранного файла → ошибка с id входа", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    const r = buildComplexPlan(graph, new Map()); // нет пути для in
    expect(isComplexError(r)).toBe(true);
    if (!isComplexError(r)) return;
    expect(r.invalidNodeIds).toContain("in");
  });

  it("оборванная цепочка → ошибка (topoSort вернул null)", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("a", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "a")], // a → out нет
    };
    const r = buildComplexPlan(graph, new Map([["in", "input.mp4"]]));
    expect(isComplexError(r)).toBe(true);
  });

  it("неизвестный фильтр → ошибка с id ноды", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("x", "filter", "no-such"), node("out", "output")],
      edges: [edge("in", "x"), edge("x", "out")],
    };
    const r = buildComplexPlan(graph, new Map([["in", "input.mp4"]]));
    expect(isComplexError(r)).toBe(true);
    if (!isComplexError(r)) return;
    expect(r.invalidNodeIds).toContain("x");
  });
});
