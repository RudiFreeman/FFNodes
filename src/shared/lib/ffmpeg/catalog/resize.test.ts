// Тесты «Изменить размер» с пресетами по короткой стороне (N-006).
// Пресет = привычные «720p/1080p»: число = высота для горизонтального и ширина для
// вертикального видео. Проверяем toCommand, предсказание applyToInfo на обоих ориентациях
// и что вертикаль больше НЕ раздувается.
import { describe, it, expect } from "vitest";
import { scale } from "./resize";
import type { MediaInfo } from "../../../types/media";

// Минимальный MediaInfo с заданными размерами (остальное не важно для resize)
const info = (width: number, height: number): MediaInfo =>
  ({ width, height }) as MediaInfo;

const P1080 = "1080p";
const P720 = "720p";
const PHALF = "Половина";
const PCUSTOM = "Свои размеры";

describe("scale.toCommand — пресеты", () => {
  it("пресет по короткой стороне → арифметика round (НЕ -2 внутри if) + экранирование запятых", () => {
    // -2 внутри if() трактуется буквально (ошибка ffmpeg) — поэтому вторую сторону
    // считаем round(x/2)*2. Гориз: h=720, w=round(iw*720/ih/2)*2; верт: наоборот.
    expect(scale.toCommand({ preset: P720 }).vf).toBe(
      "scale=w=if(gt(iw\\,ih)\\,round(iw*720/ih/2)*2\\,720):h=if(gt(iw\\,ih)\\,720\\,round(ih*720/iw/2)*2)",
    );
  });

  it("Половина → trunc-выражение (чётно-безопасно)", () => {
    expect(scale.toCommand({ preset: PHALF }).vf).toBe("scale=trunc(iw/4)*2:trunc(ih/4)*2");
  });

  it("Свои размеры → scale=width:height", () => {
    expect(scale.toCommand({ preset: PCUSTOM, width: 1280, height: -2 }).vf).toBe(
      "scale=1280:-2",
    );
  });

  it("дефолт (без preset) ведёт себя как 1080p", () => {
    expect(scale.toCommand({}).vf).toContain("1080");
  });
});

describe("scale.applyToInfo — короткая сторона, привычные значения", () => {
  it("горизонталь 1920×1080, 720p → 1280×720 (привычное 720p)", () => {
    const out = scale.applyToInfo!(info(1920, 1080), { preset: P720 });
    expect([out.width, out.height]).toEqual([1280, 720]);
  });

  it("вертикаль 1080×1920, 720p → 720×1280 (НЕ раздувается)", () => {
    // N-006: раньше width=1280 раздувал бы 1080×1920 → 1280×2276. Теперь короткая=720.
    const out = scale.applyToInfo!(info(1080, 1920), { preset: P720 });
    expect([out.width, out.height]).toEqual([720, 1280]);
  });

  it("вертикаль 1080×1920, 1080p → 1080×1920 (без изменений, не раздув)", () => {
    const out = scale.applyToInfo!(info(1080, 1920), { preset: P1080 });
    expect([out.width, out.height]).toEqual([1080, 1920]);
  });

  it("горизонталь 1920×1080, 1080p → 1920×1080 (без изменений)", () => {
    const out = scale.applyToInfo!(info(1920, 1080), { preset: P1080 });
    expect([out.width, out.height]).toEqual([1920, 1080]);
  });

  it("Половина → ровно половина по обеим сторонам, чётно", () => {
    const out = scale.applyToInfo!(info(1920, 1080), { preset: PHALF });
    expect([out.width, out.height]).toEqual([960, 540]);
  });

  it("Свои размеры с авто-высотой (-2) считает по пропорциям входа", () => {
    const out = scale.applyToInfo!(info(1920, 1080), { preset: PCUSTOM, width: 1280, height: -2 });
    expect(out.width).toBe(1280);
    expect(out.height).toBe(720);
  });

  it("без размеров входа предсказание не падает (возвращает info)", () => {
    const out = scale.applyToInfo!(info(0, 0), { preset: P720 });
    expect(out).toBeDefined();
  });
});
