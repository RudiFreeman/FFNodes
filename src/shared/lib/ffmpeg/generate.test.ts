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
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
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
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 640, height: -2 }),
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
        node("f_scale", "filter", "scale", { preset: "Свои размеры", width: 320, height: -2 }),
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

  it("операция с выходными опциями: compress → -c:v -crf после -vf", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("f2", "filter", "compress", { crf: 23 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "f2"), edge("f2", "out")],
    };
    const r = generateCommand(graph);
    expect(r.error).toBeUndefined();
    // vf только от scale; compress даёт выходные опции
    expect(r.display).toBe(
      'ffmpeg -i input.mp4 -vf "scale=1280:-2" -c:v libx264 -crf 23 output.mp4',
    );
  });

  it("аудиофильтр + видеофильтр: -vf и -af обе цепочки в правильном порядке", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("f2", "filter", "volume", { factor: 2 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "f2"), edge("f2", "out")],
    };
    const r = generateCommand(graph);
    expect(r.error).toBeUndefined();
    expect(r.display).toBe(
      'ffmpeg -i input.mp4 -vf "scale=1280:-2" -af "volume=2" output.mp4',
    );
  });

  it("только выходные опции (без vf): извлечь аудио", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "extract_audio", {}),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    expect(generateCommand(graph).display).toBe(
      "ffmpeg -i input.mp4 -vn -c:a copy output.mp4",
    );
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

describe("generateCommand — filter_complex путь (DAG)", () => {
  it("GIF-палитра (N-008): split+palettegen+paletteuse через -filter_complex, -map, -f gif", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "to_gif", { fps: 12, width: 480 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    const r = generateCommand(graph);
    expect(r.error).toBeUndefined();
    expect(r.args).toEqual([
      "-i",
      "input.mp4",
      "-filter_complex",
      "[0:v]fps=12,scale=480:-1:flags=lanczos,split[gs1][gs2];[gs1]palettegen[gp];[gs2][gp]paletteuse[v1]",
      "-map",
      "[v1]",
      "-f",
      "gif",
      "output.mp4",
    ]);
    expect(r.display).toBe(
      'ffmpeg -i input.mp4 -filter_complex "[0:v]fps=12,scale=480:-1:flags=lanczos,split[gs1][gs2];[gs1]palettegen[gp];[gs2][gp]paletteuse[v1]" -map [v1] -f gif output.mp4',
    );
  });

  it("путь входа берётся из params.path ноды (multi-input модель)", () => {
    // У input-ноды путь задан прямо в params (как для дополнительных входов в Фазе 3)
    const graph: Graph = {
      nodes: [
        node("in", "input", undefined, { path: "/videos/from-params.mp4" }),
        node("f1", "filter", "to_gif", { fps: 12, width: 480 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    // inputPath не передаём — путь должен прийти из params.path
    const r = generateCommand(graph);
    expect(r.args).toContain("/videos/from-params.mp4");
  });

  it("GIF-палитра: реальный путь в args, короткое имя в display", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "to_gif", { fps: 15, width: 320 }),
        node("out", "output"),
      ],
      edges: [edge("in", "f1"), edge("f1", "out")],
    };
    const r = generateCommand(graph, "/Users/me/clip.mov");
    expect(r.args).toContain("/Users/me/clip.mov");
    expect(r.display).toContain("ffmpeg -i clip.mov -filter_complex");
  });
});

describe("generateCommand — мульти-аутпут (Спринт 3, Вариант A)", () => {
  it("один вход → два выхода: split + две секции -map/outputArgs/файл", () => {
    // in → c1(compress 18) → out1; in → c2(compress 28) → out2
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
    const r = generateCommand(graph, "/clip.mp4");
    expect(r.error).toBeUndefined();
    expect(r.outputPlaceholders).toEqual(["output_0.mp4", "output_1.mp4"]);
    expect(r.args).toEqual([
      "-i",
      "/clip.mp4",
      "-filter_complex",
      "[0:v]split=2[v1][v2];[0:a]asplit=2[a1][a2]",
      "-map",
      "[v1]",
      "-map",
      "[a1]",
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "output_0.mp4",
      "-map",
      "[v2]",
      "-map",
      "[a2]",
      "-c:v",
      "libx264",
      "-crf",
      "28",
      "output_1.mp4",
    ]);
  });

  it("display показывает короткое имя входа и обе выходные секции", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("out1", "output"),
        node("out2", "output"),
      ],
      edges: [edge("in", "out1"), edge("in", "out2")],
    };
    const r = generateCommand(graph, "/path/to/clip.mp4");
    expect(r.display).toContain("-i clip.mp4");
    expect(r.display).toContain("output_0.mp4");
    expect(r.display).toContain("output_1.mp4");
  });
});

describe("generateCommand — неполный граф → ошибка, не падение", () => {
  it("нет output", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("f1", "filter", "scale", { preset: "Свои размеры", width: 1, height: 1 })],
      edges: [edge("in", "f1")],
    };
    expect(generateCommand(graph).error).toBeTruthy();
  });

  it("цепочка оборвана (фильтр ни с чем не связан с output)", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 1, height: 1 }),
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
        node("f1", "filter", "scale", { preset: "Свои размеры", width: 1, height: 1 }),
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

  // Висящий доп. выход без подведённой ветки → ошибка целостности (topoSort null), не падение.
  it("мульти-аутпут: висящий доп. выход без ветки → ошибка", () => {
    const graph: Graph = {
      nodes: [
        node("in", "input"),
        node("a", "filter", "scale", { preset: "Свои размеры", width: 1, height: 1 }),
        node("out1", "output"),
        node("out2", "output"), // не подключён
      ],
      edges: [edge("in", "a"), edge("a", "out1")],
    };
    expect(generateCommand(graph).error).toBeTruthy();
  });
});
