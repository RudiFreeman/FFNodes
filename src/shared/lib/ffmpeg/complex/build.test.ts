// Тесты построителя filter_complex (build.ts). Аллокация лейблов — тончайшее место,
// покрываем плотно. Merge-операции (overlay/concat/gif) появляются в каталоге позже
// (Фазы 4-5) — их end-to-end проверки там; здесь — оборачивание лейблов и топология.
import { describe, it, expect } from "vitest";
import { buildComplexPlan, buildMultiOutputPlan } from "./build";
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

describe("buildMultiOutputPlan — мульти-аутпут (1 вход → N выходов)", () => {
  it("один вход → два выхода через split: 2 ветки scale, по выходу на каждую", () => {
    // in → a(scale 1920) → out1; in → b(scale 1280) → out2 — вход ветвится на 2 выхода
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 1920, height: -2 }),
        node("b", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "a"), edge("in", "b"), edge("a", "out1"), edge("b", "out2")],
    };
    const r = buildMultiOutputPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    expect(r.inputs).toEqual(["input.mp4"]);
    // 0:v и 0:a читаются дважды (две ветки) → split=2/asplit=2; затем каждая ветка scale
    expect(r.filterComplex).toBe(
      "[0:v]split=2[v1][v2];[0:a]asplit=2[a1][a2];[v1]scale=1920:-2[v3];[v2]scale=1280:-2[v4]",
    );
    expect(r.outputs).toHaveLength(2);
    expect(r.outputs[0]).toMatchObject({ nodeId: "out1", mapVideo: "v3", mapAudio: "a1" });
    expect(r.outputs[1]).toMatchObject({ nodeId: "out2", mapVideo: "v4", mapAudio: "a2" });
  });

  it("разные кодеки по выходам: outputArgs ветки идут к своему выходу", () => {
    // in → c1(compress crf18) → out1; in → c2(compress crf28) → out2
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("c1", "filter", "compress", { crf: 18 }),
        node("c2", "filter", "compress", { crf: 28 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "c1"), edge("in", "c2"), edge("c1", "out1"), edge("c2", "out2")],
    };
    const r = buildMultiOutputPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    // compress без vf → ветки только из split (поток проходит насквозь к выходу)
    expect(r.outputs[0].outputArgs).toEqual(["-c:v", "libx264", "-crf", "18"]);
    expect(r.outputs[1].outputArgs).toEqual(["-c:v", "libx264", "-crf", "28"]);
    // split=2/asplit=2 нужны: 0:v и 0:a читаются двумя выходами (compress без vf — насквозь)
    expect(r.filterComplex).toBe("[0:v]split=2[v1][v2];[0:a]asplit=2[a1][a2]");
    expect(r.outputs[0]).toMatchObject({ mapVideo: "v1", mapAudio: "a1" });
    expect(r.outputs[1]).toMatchObject({ mapVideo: "v2", mapAudio: "a2" });
  });

  it("три выхода: split=3", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("out1", "output"),
        node("out2", "output"),
        node("out3", "output"),
      ],
      edges: [edge("in", "out1"), edge("in", "out2"), edge("in", "out3")],
    };
    const r = buildMultiOutputPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    // видео и аудио размножаются split=3/asplit=3 (все три выхода мапят 0:v и 0:a)
    expect(r.filterComplex).toBe("[0:v]split=3[v1][v2][v3];[0:a]asplit=3[a1][a2][a3]");
    expect(r.outputs.map((o) => o.mapVideo)).toEqual(["v1", "v2", "v3"]);
    expect(r.outputs.map((o) => o.mapAudio)).toEqual(["a1", "a2", "a3"]);
  });

  it("общий фильтр до развилки: scale один раз, потом split на 2 выхода", () => {
    // in → s(scale) → split → out1, out2 (общий шаг до развилки)
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("s", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "s"), edge("s", "out1"), edge("s", "out2")],
    };
    const r = buildMultiOutputPlan(graph, new Map([["in", "input.mp4"]]));
    if (isComplexError(r)) throw new Error(r.error);
    // scale применяется один раз (v1, общий шаг), затем split на два выхода; аудио asplit
    expect(r.filterComplex).toBe(
      "[0:v]scale=1280:-2[v1];[v1]split=2[v2][v3];[0:a]asplit=2[a1][a2]",
    );
    expect(r.outputs.map((o) => o.mapVideo)).toEqual(["v2", "v3"]);
    expect(r.outputs.map((o) => o.mapAudio)).toEqual(["a1", "a2"]);
  });

  it("вход без файла → ошибка", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out1", "output"), node("out2", "output")],
      edges: [edge("in", "out1"), edge("in", "out2")],
    };
    const r = buildMultiOutputPlan(graph, new Map());
    expect(isComplexError(r)).toBe(true);
  });

  it("overlay в одной ветке + прямой выход: аудио НЕ даёт орфан-asplit (регрессия ревью)", () => {
    // in1 (аудио) → overlay[in-main]; in2 (логотип) → overlay[in-overlay]; overlay → out1;
    // in1 → out2 напрямую. Аудио in1 потребляет ТОЛЬКО out2 (overlay аудио накладки не берёт).
    // До фикжа: countUses(in1).a=2 → asplit=2[a1][a2], a1 уходил в overlay и оставался орфаном.
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("ov", "filter", "overlay", { x: 0, y: 0 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [
        edge("in1", "ov", "in-main"),
        edge("in2", "ov", "in-overlay"),
        edge("ov", "out1"),
        edge("in1", "out2"),
      ],
    };
    const r = buildMultiOutputPlan(
      graph,
      new Map([
        ["in1", "main.mp4"],
        ["in2", "logo.png"],
      ]),
    );
    if (isComplexError(r)) throw new Error(r.error);
    // НЕТ asplit аудио (in1.a потребляет только out2) — иначе была бы неподключённая ветка
    expect(r.filterComplex).not.toContain("asplit");
    // out2 мапит аудио in1 напрямую (0:a), out1 (overlay) аудио не имеет
    const out1 = r.outputs.find((o) => o.nodeId === "out1")!;
    const out2 = r.outputs.find((o) => o.nodeId === "out2")!;
    expect(out2.mapAudio).toBe("0:a");
    expect(out1.mapAudio).toBeNull();
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
