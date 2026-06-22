// Тесты «Сменить кодек» — дефолт из метаданных входа (Спринт 2): нода открывается с уже
// выбранным текущим кодеком входа (хедлайн-сценарий: H.264 уже стоит, сменить на H.265).
import { describe, it, expect } from "vitest";
import { changeCodec } from "./convert";
import type { MediaInfo } from "../../../types/media";

describe("changeCodec.defaultsFromInfo — текущий кодек входа", () => {
  it("h264 → опция «H.264»", () => {
    expect(changeCodec.defaultsFromInfo!({ video_codec: "h264" } as MediaInfo)).toEqual({
      codec: "H.264",
    });
  });

  it("hevc → опция «H.265 / HEVC»", () => {
    expect(changeCodec.defaultsFromInfo!({ video_codec: "hevc" } as MediaInfo)).toEqual({
      codec: "H.265 / HEVC",
    });
  });

  it("vp9 → опция «VP9»", () => {
    expect(changeCodec.defaultsFromInfo!({ video_codec: "vp9" } as MediaInfo)).toEqual({
      codec: "VP9",
    });
  });

  it("кодек вне списка опций (av1) → пусто (остаётся статичный «H.264»)", () => {
    expect(changeCodec.defaultsFromInfo!({ video_codec: "av1" } as MediaInfo)).toEqual({});
  });

  it("без кодека входа (null) → пусто", () => {
    expect(changeCodec.defaultsFromInfo!({} as MediaInfo)).toEqual({});
  });
});
