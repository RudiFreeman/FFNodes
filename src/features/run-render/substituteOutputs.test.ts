// Тесты подстановки выходных путей вместо плейсхолдеров (мульти-аутпут, Спринт 3).
import { describe, it, expect } from "vitest";
import { substituteOutputs } from "./substituteOutputs";

describe("substituteOutputs", () => {
  it("одиночный выход: один плейсхолдер заменяется на путь", () => {
    const args = ["-i", "in.mp4", "-vf", "scale=1280:-2", "output.mp4"];
    const r = substituteOutputs(args, ["output.mp4"], ["/out/clip.mp4"]);
    expect(r).toEqual(["-i", "in.mp4", "-vf", "scale=1280:-2", "/out/clip.mp4"]);
  });

  it("мульти-аутпут: каждый плейсхолдер → свой путь по индексу", () => {
    const args = [
      "-i",
      "in.mp4",
      "-filter_complex",
      "[0:v]split=2[v1][v2]",
      "-map",
      "[v1]",
      "output_0.mp4",
      "-map",
      "[v2]",
      "output_1.mp4",
    ];
    const r = substituteOutputs(
      args,
      ["output_0.mp4", "output_1.mp4"],
      ["/a/first.mp4", "/b/second.mp4"],
    );
    expect(r).toEqual([
      "-i",
      "in.mp4",
      "-filter_complex",
      "[0:v]split=2[v1][v2]",
      "-map",
      "[v1]",
      "/a/first.mp4",
      "-map",
      "[v2]",
      "/b/second.mp4",
    ]);
  });

  it("не трогает обычные аргументы, совпадающие по содержимому не-плейсхолдеры", () => {
    // плейсхолдеры — только заявленные; прочее (даже похожее) остаётся как есть
    const args = ["-i", "input.mp4", "output_0.mp4"];
    const r = substituteOutputs(args, ["output_0.mp4"], ["/real.mp4"]);
    expect(r).toEqual(["-i", "input.mp4", "/real.mp4"]);
  });
});
