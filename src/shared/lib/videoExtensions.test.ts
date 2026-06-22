// Тесты отсева не-видео при drag&drop (диалог фильтрует ОС, для drop — мы сами).
import { describe, it, expect } from "vitest";
import { isSupportedVideo, VIDEO_EXTENSIONS } from "./videoExtensions";

describe("isSupportedVideo", () => {
  it("принимает поддерживаемые видеорасширения", () => {
    for (const ext of VIDEO_EXTENSIONS) {
      expect(isSupportedVideo(`/Users/a/clip.${ext}`)).toBe(true);
    }
  });

  it("регистр расширения не важен", () => {
    expect(isSupportedVideo("/Users/a/CLIP.MP4")).toBe(true);
    expect(isSupportedVideo("/Users/a/clip.MoV")).toBe(true);
  });

  it("отклоняет не-видео и файлы без расширения", () => {
    expect(isSupportedVideo("/Users/a/photo.jpg")).toBe(false);
    expect(isSupportedVideo("/Users/a/notes.txt")).toBe(false);
    expect(isSupportedVideo("/Users/a/Makefile")).toBe(false);
    expect(isSupportedVideo("")).toBe(false);
  });

  it("точки в пути не путают определение расширения", () => {
    expect(isSupportedVideo("/Users/a.b/my.video.mp4")).toBe(true);
    expect(isSupportedVideo("/Users/a.b/archive.mp4.zip")).toBe(false);
  });
});
