// Тесты пресетов: извлечение ветки выхода (extractBranch) и round-trip Preset→JSON→Preset.
import { describe, it, expect } from "vitest";
import { extractBranch, buildPreset, parsePreset, PresetFormatError, PRESET_FORMAT } from "./preset";
import type { Graph, GraphNode, GraphEdge, ParamValue } from "../../types/graph";

const node = (
  id: string,
  kind: GraphNode["kind"],
  filterId?: string,
  params: Record<string, ParamValue> = {},
): GraphNode => ({ id, kind, filterId, params, position: { x: 0, y: 0 } });

const edge = (source: string, target: string, targetHandle?: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  targetHandle,
});

describe("extractBranch", () => {
  it("линейная ветка: фильтры в порядке вход→выход", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("scale", "filter", "scale", { preset: "720p" }),
        node("fps", "filter", "fps", { fps: 30 }),
        node("out", "output"),
      ],
      edges: [edge("in", "scale"), edge("scale", "fps"), edge("fps", "out")],
    };
    const steps = extractBranch(graph, "out");
    expect(steps).toEqual([
      { filterId: "scale", params: { preset: "720p" } },
      { filterId: "fps", params: { fps: 30 } },
    ]);
  });

  it("мульти-аутпут: каждая ветка извлекается отдельно", () => {
    // Вход → split на два выхода: out1 через scale, out2 через blur
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("s", "filter", "scale", { preset: "1080p" }),
        node("b", "filter", "gblur", { sigma: 5 }),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "s"), edge("s", "out1"), edge("in", "b"), edge("b", "out2")],
    };
    expect(extractBranch(graph, "out1")).toEqual([{ filterId: "scale", params: { preset: "1080p" } }]);
    expect(extractBranch(graph, "out2")).toEqual([{ filterId: "gblur", params: { sigma: 5 } }]);
  });

  it("выход без фильтров → пустой массив (валидно)", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    expect(extractBranch(graph, "out")).toEqual([]);
  });

  it("ветка со слиянием (merge, 2 входящих) не сохраняется → null", () => {
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("mrg", "filter", "overlay"),
        node("out", "output"),
      ],
      edges: [edge("in1", "mrg", "in-0"), edge("in2", "mrg", "in-1"), edge("mrg", "out")],
    };
    expect(extractBranch(graph, "out")).toBeNull();
  });

  it("несуществующий/не-выход id → null", () => {
    const graph: Graph = { nodes: [node("in", "input")], edges: [] };
    expect(extractBranch(graph, "ghost")).toBeNull();
    expect(extractBranch(graph, "in")).toBeNull(); // не output
  });
});

describe("buildPreset + parsePreset round-trip", () => {
  it("пресет ветки переживает JSON-сериализацию", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("s", "filter", "scale", { preset: "720p" }),
        node("out", "output"),
      ],
      edges: [edge("in", "s"), edge("s", "out")],
    };
    const preset = buildPreset("Telegram 720p", graph, "out")!;
    expect(preset.format).toBe(PRESET_FORMAT);
    const back = parsePreset(JSON.parse(JSON.stringify(preset)));
    expect(back.name).toBe("Telegram 720p");
    expect(back.steps).toEqual([{ filterId: "scale", params: { preset: "720p" } }]);
  });

  it("buildPreset для ветки со слиянием → null", () => {
    const graph: Graph = {
      nodes: [node("a", "input"), node("b", "input"), node("m", "filter", "concat"), node("out", "output")],
      edges: [edge("a", "m", "in-0"), edge("b", "m", "in-1"), edge("m", "out")],
    };
    expect(buildPreset("x", graph, "out")).toBeNull();
  });
});

describe("parsePreset валидация", () => {
  it("чужой/битый формат → PresetFormatError", () => {
    expect(() => parsePreset({ some: "json" })).toThrow(PresetFormatError);
    expect(() => parsePreset(null)).toThrow(PresetFormatError);
  });

  it("версия из будущего → ошибка", () => {
    expect(() => parsePreset({ format: PRESET_FORMAT, version: 99, steps: [] })).toThrow(PresetFormatError);
  });

  it("кривые шаги отсеиваются, params санируются", () => {
    const preset = parsePreset({
      format: PRESET_FORMAT,
      version: 1,
      name: "p",
      steps: [
        { filterId: "scale", params: { preset: "720p", bad: { x: 1 } } },
        { notFilterId: "x" }, // без filterId — пропускается
        "garbage",
      ],
    });
    expect(preset.steps).toEqual([{ filterId: "scale", params: { preset: "720p" } }]);
  });
});
