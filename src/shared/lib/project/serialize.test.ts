// Тесты сериализации + round-trip (граф → JSON → граф) файла проекта.
// Главное свойство: сохраняемые поля холста переживают serialize→deserialize без потерь
// (включая мульти-аутпут и merge-ноды с targetHandle). Рантайм-поля (колбэки, info) при
// сериализации отбрасываются.
import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import { serializeProject } from "./serialize";
import { deserializeProject } from "./deserialize";
import { PROJECT_FORMAT, PROJECT_VERSION } from "./project";

describe("serializeProject", () => {
  it("выдёргивает только сохраняемые поля, отбрасывая рантайм (колбэки, info)", () => {
    const nodes: Node[] = [
      { id: "input", type: "input-file", position: { x: 80, y: 200 }, deletable: false, data: { info: { width: 1920 } } },
      {
        id: "u1",
        type: "filter",
        position: { x: 280, y: 80 },
        data: { filterId: "scale", params: { preset: "720p" }, onParamChange: () => {}, invalid: true },
      },
      { id: "output", type: "output-file", position: { x: 560, y: 200 }, deletable: false, data: { info: null } },
    ];
    const edges: Edge[] = [
      { id: "input-u1", source: "input", target: "u1" },
      { id: "u1-output", source: "u1", target: "output" },
    ];

    const file = serializeProject("Тест", "/clips/in.mp4", nodes, edges);

    expect(file.format).toBe(PROJECT_FORMAT);
    expect(file.version).toBe(PROJECT_VERSION);
    expect(file.name).toBe("Тест");
    expect(file.inputPath).toBe("/clips/in.mp4");
    // У фильтра сохранены filterId+params, но НЕ onParamChange/invalid
    const u1 = file.nodes.find((n) => n.id === "u1")!;
    expect(u1.filterId).toBe("scale");
    expect(u1.params).toEqual({ preset: "720p" });
    expect(u1).not.toHaveProperty("onParamChange");
    expect(u1).not.toHaveProperty("invalid");
    // У основного входа info не сохраняется, путь — в inputPath, не в ноде
    const input = file.nodes.find((n) => n.id === "input")!;
    expect(input).not.toHaveProperty("path");
    expect(input).not.toHaveProperty("info");
  });

  it("сохраняет путь дополнительного входа в ноде", () => {
    const nodes: Node[] = [
      { id: "in2", type: "input-file", position: { x: 80, y: 360 }, deletable: true, data: { path: "/clips/logo.png", info: null } },
    ];
    const file = serializeProject("p", null, nodes, []);
    expect(file.nodes[0].path).toBe("/clips/logo.png");
    expect(file.nodes[0].deletable).toBe(true);
  });

  it("сохраняет targetHandle ребра только когда он есть", () => {
    const edges: Edge[] = [
      { id: "a-b", source: "a", target: "b" },
      { id: "c-mrg", source: "c", target: "mrg", targetHandle: "in-1" },
    ];
    const file = serializeProject("p", null, [], edges);
    expect(file.edges[0]).not.toHaveProperty("targetHandle");
    expect(file.edges[1].targetHandle).toBe("in-1");
  });
});

describe("round-trip граф → JSON → граф", () => {
  it("мульти-аутпут + merge с targetHandle переживают сериализацию без потерь", () => {
    const nodes: Node[] = [
      { id: "input", type: "input-file", position: { x: 80, y: 200 }, deletable: false, data: {} },
      { id: "in2", type: "input-file", position: { x: 80, y: 360 }, deletable: true, data: { path: "/clips/b.mp4" } },
      { id: "mrg", type: "merge", position: { x: 280, y: 200 }, data: { filterId: "overlay", params: {} } },
      { id: "s1", type: "filter", position: { x: 420, y: 80 }, data: { filterId: "scale", params: { preset: "1080p" } } },
      { id: "output", type: "output-file", position: { x: 600, y: 80 }, deletable: false, data: {} },
      { id: "out2", type: "output-file", position: { x: 600, y: 300 }, deletable: true, data: {} },
    ];
    const edges: Edge[] = [
      { id: "input-mrg", source: "input", target: "mrg", targetHandle: "in-0" },
      { id: "in2-mrg", source: "in2", target: "mrg", targetHandle: "in-1" },
      { id: "mrg-s1", source: "mrg", target: "s1" },
      { id: "s1-output", source: "s1", target: "output" },
      { id: "mrg-out2", source: "mrg", target: "out2" },
    ];

    // serialize → JSON-строка → parse → deserialize (полный цикл сохранения на диск)
    const json = JSON.stringify(serializeProject("Проект", "/clips/a.mp4", nodes, edges));
    const result = deserializeProject(JSON.parse(json));

    expect(result.warnings).toEqual([]);
    expect(result.inputPath).toBe("/clips/a.mp4");
    expect(result.nodes).toHaveLength(6);
    expect(result.edges).toHaveLength(5);

    // Сверяем сохраняемые поля (рантайм-поля в восстановленных нодах отсутствуют, это ок)
    const back = (id: string) => result.nodes.find((n) => n.id === id)!;
    expect(back("in2").type).toBe("input-file");
    expect((back("in2").data as { path?: string }).path).toBe("/clips/b.mp4");
    expect(back("in2").deletable).toBe(true);
    expect((back("s1").data as { params?: unknown }).params).toEqual({ preset: "1080p" });
    expect(back("out2").deletable).toBe(true);
    expect(back("output").deletable).toBe(false);

    const mrgEdge = result.edges.find((e) => e.id === "in2-mrg")!;
    expect(mrgEdge.targetHandle).toBe("in-1");
  });
});
