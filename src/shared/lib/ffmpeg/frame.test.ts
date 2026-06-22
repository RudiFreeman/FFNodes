// Тесты извлечения vf-цепочки для превью-кадра «После». См. frame.ts.
import { describe, it, expect } from "vitest";
import { videoFilterChain, previewPlan, previewMoment } from "./frame";
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

  it("мульти-аутпут: план кадра для ВЫБРАННОГО выхода (его mapVideo-ветка)", () => {
    // in → a(scale) → out1; in → b(scale) → out2 — у выходов разные ветки/лейблы
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 1920, height: -2 }),
        node("b", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "a"), edge("in", "b"), edge("a", "out1"), edge("b", "out2")],
    };
    const paths = new Map([["in", "input.mp4"]]);
    const p1 = previewPlan(graph, paths, "out1");
    const p2 = previewPlan(graph, paths, "out2");
    expect(p1?.kind).toBe("complex");
    expect(p2?.kind).toBe("complex");
    if (p1?.kind !== "complex" || p2?.kind !== "complex") return;
    // Разные выходы → разные mapVideo (каждый мапит свою ветку), filter_complex общий
    expect(p1.spec.mapVideo).not.toBe(p2.spec.mapVideo);
    expect(p1.spec.filterComplex).toContain("split");
  });
});

describe("previewMoment (N-012)", () => {
  it("без trim → середина исходника (duration/2)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "a"), edge("a", "out")],
    };
    expect(previewMoment(graph, 60)).toBe(30);
  });

  it("trim → середина диапазона trim (внутри обрезки, не середина исходника)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("t", "filter", "trim", { start: 0, end: 2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "t"), edge("t", "out")],
    };
    // исходник 10с: без фикса было бы 5с (вне 0..2), с фиксом — 1с (середина 0..2)
    expect(previewMoment(graph, 10)).toBe(1);
  });

  it("trim со сдвигом: start=4 end=8 → середина 6с", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("t", "filter", "trim", { start: 4, end: 8 }),
        node("out", "output"),
      ],
      edges: [edge("in", "t"), edge("t", "out")],
    };
    expect(previewMoment(graph, 30)).toBe(6);
  });

  it("момент trim не превышает длительность исходника", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("t", "filter", "trim", { start: 0, end: 100 }),
        node("out", "output"),
      ],
      edges: [edge("in", "t"), edge("t", "out")],
    };
    // середина 0..100 = 50, но исходник 10с → подрезаем к 10
    expect(previewMoment(graph, 10)).toBe(10);
  });

  it("невалидный trim (end ≤ start) игнорируется → fallback середина исходника", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("t", "filter", "trim", { start: 8, end: 2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "t"), edge("t", "out")],
    };
    expect(previewMoment(graph, 20)).toBe(10);
  });

  it("неизвестная длительность без trim → 0", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(previewMoment(graph, null)).toBe(0);
  });

  it("speed НЕ влияет на момент: середина исходника (кадр валиден, setpts только меняет PTS)", () => {
    // Намеренная страховка: speed=setpts меняет лишь временну́ю шкалу, не содержимое.
    // -ss seek-ит по исходнику ДО vf → кадр на середине исходника репрезентативен и совпадает
    // с «До». Делить момент на factor НЕЛЬЗЯ — это рассогласовало бы кадры «До»/«После».
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("s", "filter", "speed", { factor: 4 }),
        node("out", "output"),
      ],
      edges: [edge("in", "s"), edge("s", "out")],
    };
    expect(previewMoment(graph, 10)).toBe(5);
  });

  it("trim перед speed: момент по trim (trim определяет видимый диапазон)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("t", "filter", "trim", { start: 2, end: 6 }),
        node("s", "filter", "speed", { factor: 2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "t"), edge("t", "s"), edge("s", "out")],
    };
    // trim 2..6 → середина 4с (speed момент не меняет)
    expect(previewMoment(graph, 30)).toBe(4);
  });
});
