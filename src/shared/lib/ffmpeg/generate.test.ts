// Тесты генератора команды. Сердце проекта (см. docs/ARCHITECTURE.md §4, §9).
import { describe, it, expect } from "vitest";
import { generateCommand } from "./generate";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";

// Хелперы для сборки тестовых графов
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

describe("generateCommand — линейная цепочка по связям", () => {
  it("input → scale → output: собирает -vf", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { width: 1280, height: -2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    const r = generateCommand(graph);
    expect(r.error).toBeUndefined();
    expect(r.display).toBe('ffmpeg -i input.mp4 -vf "scale=1280:-2" output.mp4');
    expect(r.args).toEqual(["-i", "input.mp4", "-vf", "scale=1280:-2", "output.mp4"]);
  });

  it("два фильтра по порядку связей: scale,fps", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { width: 640, height: -2 }),
        node("f2", "filter", "fps", { value: 15 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "f2"), edge("f2", "out")],
    };
    expect(generateCommand(graph).display).toBe(
      'ffmpeg -i input.mp4 -vf "scale=640:-2,fps=15" output.mp4',
    );
  });

  it("порядок берётся из связей, а не из массива нод", () => {
    // ноды в массиве в обратном порядке, но связи задают fps → scale
    const graph: Graph = {
      nodes: [
        node("out", "output"),
        node("f_scale", "filter", "scale", { width: 320, height: -2 }),
        node("f_fps", "filter", "fps", { value: 10 }),
        node("in", "input"),
      ],
      edges: [edge("in", "f_fps"), edge("f_fps", "f_scale"), edge("f_scale", "out")],
    };
    expect(generateCommand(graph).display).toBe(
      'ffmpeg -i input.mp4 -vf "fps=10,scale=320:-2" output.mp4',
    );
  });

  it("input → output без фильтров: команда без -vf", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("out", "output")],
      edges: [edge("in", "out")],
    };
    const r = generateCommand(graph);
    expect(r.error).toBeUndefined();
    expect(r.display).toBe("ffmpeg -i input.mp4 output.mp4");
  });

  it("реальный путь: args — полный путь, display — короткое имя", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "fps", { value: 24 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    const r = generateCommand(graph, "/Users/me/My Videos/clip.mov");
    // args содержит полный путь (для запуска)
    expect(r.args).toContain("/Users/me/My Videos/clip.mov");
    // display — короткое имя (для читаемости)
    expect(r.display).toBe('ffmpeg -i clip.mov -vf "fps=24" output.mp4');
  });
});

describe("generateCommand — неполный граф → ошибка, не падение", () => {
  it("нет output", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("f1", "filter", "scale", { width: 1, height: 1 })],
      edges: [edge("in", "f1")],
    };
    expect(generateCommand(graph).error).toBeTruthy();
  });

  it("цепочка оборвана (фильтр ни с чем не связан с output)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { width: 1, height: 1 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1")], // f1 → out нет
    };
    expect(generateCommand(graph).error).toBeTruthy();
  });

  it("цикл не зацикливает генератор", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { width: 1, height: 1 }),
        node("f2", "filter", "fps", { value: 1 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "f2"), edge("f2", "f1")], // f1↔f2 цикл
    };
    expect(generateCommand(graph).error).toBeTruthy();
  });

  it("пустой граф", () => {
    expect(generateCommand({ nodes: [], edges: [] }).error).toBeTruthy();
  });
});
