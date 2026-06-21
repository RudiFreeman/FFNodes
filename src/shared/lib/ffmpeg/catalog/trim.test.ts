// Тесты «Обрезка» — дефолты из метаданных входа (Спринт 2): «Обрезать по времени» ставит
// конец = длительность входа (весь ролик), «Кадрировать» — область = полный кадр входа.
import { describe, it, expect } from "vitest";
import { trim, crop } from "./trim";
import type { MediaInfo } from "../../../types/media";

describe("trim.defaultsFromInfo — конец = длительность входа", () => {
  it("end = длительность входа, округлённая (12.4 → 12)", () => {
    expect(trim.defaultsFromInfo!({ duration: 12.4 } as MediaInfo)).toEqual({ end: 12 });
  });

  it("без длительности входа (null) → пусто (остаётся статичный 10)", () => {
    expect(trim.defaultsFromInfo!({} as MediaInfo)).toEqual({});
  });
});

describe("crop.defaultsFromInfo — область = полный кадр входа", () => {
  it("w/h = разрешение входа", () => {
    expect(crop.defaultsFromInfo!({ width: 1280, height: 720 } as MediaInfo)).toEqual({
      w: 1280,
      h: 720,
    });
  });

  it("без размеров входа (null) → пусто (остаётся статичный 640×640)", () => {
    expect(crop.defaultsFromInfo!({} as MediaInfo)).toEqual({});
  });
});
