// Тесты десериализации: версионирование и устойчивость к битому/чужому содержимому.
// Главное: НЕ доверяем файлу слепо — кривой ввод даёт понятную ошибку или предупреждение,
// а не краш. Round-trip-успех проверяется в serialize.test.ts.
import { describe, it, expect } from "vitest";
import { deserializeProject, ProjectFormatError } from "./deserialize";
import { PROJECT_FORMAT, PROJECT_VERSION } from "./project";

const validFile = () => ({
  format: PROJECT_FORMAT,
  version: PROJECT_VERSION,
  name: "p",
  inputPath: "/clips/in.mp4",
  nodes: [{ id: "input", type: "input-file", position: { x: 0, y: 0 } }],
  edges: [],
});

describe("версионирование и формат", () => {
  it("чужой JSON (нет нашего format) → ProjectFormatError", () => {
    expect(() => deserializeProject({ some: "json" })).toThrow(ProjectFormatError);
  });

  it("не объект (null/строка/массив) → ProjectFormatError", () => {
    expect(() => deserializeProject(null)).toThrow(ProjectFormatError);
    expect(() => deserializeProject("nope")).toThrow(ProjectFormatError);
    expect(() => deserializeProject([])).toThrow(ProjectFormatError);
  });

  it("версия из будущего → ошибка с подсказкой обновиться", () => {
    const future = { ...validFile(), version: PROJECT_VERSION + 1 };
    expect(() => deserializeProject(future)).toThrow(/более новой версии/);
  });

  it("нет поля version → ProjectFormatError", () => {
    const f = validFile() as Record<string, unknown>;
    delete f.version;
    expect(() => deserializeProject(f)).toThrow(ProjectFormatError);
  });

  it("повреждены nodes/edges (не массивы) → ProjectFormatError", () => {
    expect(() => deserializeProject({ ...validFile(), nodes: "x" })).toThrow(ProjectFormatError);
    expect(() => deserializeProject({ ...validFile(), edges: 42 })).toThrow(ProjectFormatError);
  });
});

describe("устойчивость к мусору внутри (предупреждения, не краш)", () => {
  it("нода без id / неизвестного типа пропускается с предупреждением", () => {
    const file = {
      ...validFile(),
      nodes: [
        { id: "input", type: "input-file", position: { x: 0, y: 0 } },
        { type: "filter", position: { x: 0, y: 0 } }, // нет id
        { id: "x", type: "weird-type", position: { x: 0, y: 0 } }, // чужой тип
      ],
    };
    const r = deserializeProject(file);
    expect(r.nodes).toHaveLength(1);
    expect(r.warnings.length).toBe(2);
  });

  it("ребро к отсутствующему узлу отбрасывается с предупреждением", () => {
    const file = {
      ...validFile(),
      edges: [{ id: "e", source: "input", target: "ghost" }],
    };
    const r = deserializeProject(file);
    expect(r.edges).toHaveLength(0);
    expect(r.warnings.length).toBe(1);
  });

  it("дубль id узла — второй пропускается", () => {
    const file = {
      ...validFile(),
      nodes: [
        { id: "input", type: "input-file", position: { x: 0, y: 0 } },
        { id: "input", type: "output-file", position: { x: 0, y: 0 } },
      ],
    };
    const r = deserializeProject(file);
    expect(r.nodes).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes("Повторяющийся"))).toBe(true);
  });

  it("params: нечисловые/непримитивные значения отсеиваются", () => {
    const file = {
      ...validFile(),
      nodes: [
        {
          id: "f",
          type: "filter",
          position: { x: 0, y: 0 },
          filterId: "scale",
          params: { preset: "720p", bad: { nested: 1 }, n: 5, ok: true },
        },
      ],
    };
    const r = deserializeProject(file);
    const params = (r.nodes[0].data as { params?: Record<string, unknown> }).params!;
    expect(params).toEqual({ preset: "720p", n: 5, ok: true });
  });

  it("кривая позиция → (0,0), а не краш", () => {
    const file = {
      ...validFile(),
      nodes: [{ id: "input", type: "input-file", position: "bad" }],
    };
    const r = deserializeProject(file);
    expect(r.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it("inputPath не строка → null", () => {
    const r = deserializeProject({ ...validFile(), inputPath: 123 });
    expect(r.inputPath).toBeNull();
  });

  it("🔒 N-004: пути из файла с ведущим «-» обезопашиваются (safePath)", () => {
    const file = {
      ...validFile(),
      inputPath: "-evil.mp4", // путь-«флаг» из недоверенного файла
      nodes: [
        { id: "input", type: "input-file", position: { x: 0, y: 0 } },
        { id: "in2", type: "input-file", position: { x: 0, y: 0 }, path: "--inject" },
      ],
    };
    const r = deserializeProject(file);
    expect(r.inputPath).toBe("./-evil.mp4"); // префикс ./ не даст принять за флаг
    const in2 = r.nodes.find((n) => n.id === "in2")!;
    expect((in2.data as { path?: string }).path).toBe("./--inject");
  });
});
