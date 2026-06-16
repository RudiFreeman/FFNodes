// Тесты каталога фильтров. Чистая логика — table-driven (см. docs/ARCHITECTURE.md §9).
import { describe, it, expect } from "vitest";
import { CATALOG, getFilterDef, catalogByCategory } from "./index";

describe("catalog index", () => {
  it("содержит фильтры", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
  });

  it("у каждого фильтра есть id, label, описание и параметры", () => {
    for (const def of CATALOG) {
      expect(def.id).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(10); // описание «что и зачем»
      expect(Array.isArray(def.params)).toBe(true);
    }
  });

  it("id фильтров уникальны", () => {
    const ids = CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getFilterDef находит по id и возвращает undefined для несуществующего", () => {
    expect(getFilterDef("scale")?.label).toBe("Изменить размер");
    expect(getFilterDef("no-such-filter")).toBeUndefined();
  });

  it("catalogByCategory группирует без потери фильтров", () => {
    const total = catalogByCategory().reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(CATALOG.length);
  });
});

describe("toCommand — vf-фильтры (граф значений → vf-строка)", () => {
  const cases: { id: string; params: Record<string, string | number>; vf: string }[] = [
    { id: "scale", params: { preset: "Свои размеры", width: 1280, height: -2 }, vf: "scale=1280:-2" },
    { id: "fps", params: { value: 15 }, vf: "fps=15" },
    { id: "trim", params: { start: 0, end: 10 }, vf: "trim=start=0:end=10" },
    { id: "crop", params: { w: 640, h: 640 }, vf: "crop=640:640" },
  ];

  for (const c of cases) {
    it(`${c.id} → vf "${c.vf}"`, () => {
      const def = getFilterDef(c.id);
      expect(def).toBeDefined();
      const contrib = def!.toCommand(c.params);
      expect(contrib.vf).toBe(c.vf);
      expect(contrib.outputArgs).toBeUndefined();
    });
  }
});

describe("toCommand — операции с выходными опциями (не -vf)", () => {
  it("compress → -c:v libx264 -crf", () => {
    const c = getFilterDef("compress")!.toCommand({ crf: 23 });
    expect(c.outputArgs).toEqual(["-c:v", "libx264", "-crf", "23"]);
    expect(c.vf).toBeUndefined();
  });

  it("extract_audio → -vn -c:a copy", () => {
    expect(getFilterDef("extract_audio")!.toCommand({}).outputArgs).toEqual([
      "-vn",
      "-c:a",
      "copy",
    ]);
  });

  it("remove_audio → -an", () => {
    expect(getFilterDef("remove_audio")!.toCommand({}).outputArgs).toEqual(["-an"]);
  });
});

describe("toCommand — новые категории (поворот/скорость/цвет/GIF)", () => {
  it("rotate: 180° → два transpose", () => {
    expect(getFilterDef("rotate")!.toCommand({ angle: "180°" }).vf).toBe(
      "transpose=1,transpose=1",
    );
  });

  it("flip: вертикально → vflip", () => {
    expect(getFilterDef("flip")!.toCommand({ dir: "Вертикально" }).vf).toBe("vflip");
  });

  it("speed: множитель 2 → setpts=PTS/2", () => {
    expect(getFilterDef("speed")!.toCommand({ factor: 2 }).vf).toBe("setpts=PTS/2");
  });

  it("grayscale → hue=s=0", () => {
    expect(getFilterDef("grayscale")!.toCommand({}).vf).toBe("hue=s=0");
  });

  it("to_gif: vf-цепочка fps+scale + выход gif", () => {
    const c = getFilterDef("to_gif")!.toCommand({ fps: 12, width: 480 });
    expect(c.vf).toBe("fps=12,scale=480:-1:flags=lanczos");
    expect(c.outputArgs).toEqual(["-f", "gif"]);
  });
});

describe("toCommand — звук, эффекты, кодек", () => {
  it("volume → af volume=<множитель>", () => {
    const c = getFilterDef("volume")!.toCommand({ factor: 2 });
    expect(c.af).toBe("volume=2");
    expect(c.vf).toBeUndefined();
  });

  it("fade появление → vf fade=t=in", () => {
    expect(
      getFilterDef("fade")!.toCommand({ type: "Появление", start: 0, duration: 1 }).vf,
    ).toBe("fade=t=in:st=0:d=1");
  });

  it("fade затемнение → vf fade=t=out", () => {
    expect(
      getFilterDef("fade")!.toCommand({ type: "Затемнение", start: 9, duration: 1 }).vf,
    ).toBe("fade=t=out:st=9:d=1");
  });

  it("reverse → vf reverse", () => {
    expect(getFilterDef("reverse")!.toCommand({}).vf).toBe("reverse");
  });

  it("codec H.265 → -c:v libx265", () => {
    const c = getFilterDef("codec")!.toCommand({ codec: "H.265 / HEVC" });
    expect(c.outputArgs).toEqual(["-c:v", "libx265"]);
  });

  it("codec VP9 → -c:v libvpx-vp9", () => {
    expect(getFilterDef("codec")!.toCommand({ codec: "VP9" }).outputArgs).toEqual([
      "-c:v",
      "libvpx-vp9",
    ]);
  });
});
