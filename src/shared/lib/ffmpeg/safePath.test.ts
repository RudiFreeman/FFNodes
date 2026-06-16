// Тесты защиты пути от трактовки как флаг ffmpeg (N-004). Зеркалит Rust safe_path.
import { describe, it, expect } from "vitest";
import { safePath } from "./safePath";

describe("safePath", () => {
  it("путь с ведущим «-» получает префикс ./", () => {
    expect(safePath("-evil.mp4")).toBe("./-evil.mp4");
    expect(safePath("--output")).toBe("./--output");
  });

  it("абсолютные и обычные пути не трогаем", () => {
    expect(safePath("/Users/a/clip.mov")).toBe("/Users/a/clip.mov");
    expect(safePath("C:\\video\\clip.mp4")).toBe("C:\\video\\clip.mp4");
    expect(safePath("clip.mp4")).toBe("clip.mp4");
    expect(safePath("./clip.mp4")).toBe("./clip.mp4");
    expect(safePath("")).toBe("");
  });
});
