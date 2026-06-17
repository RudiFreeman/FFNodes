// Тесты merge-операций (overlay, concat): фрагмент filter_complex и applyMerge.
import { describe, it, expect } from "vitest";
import { overlay, concat } from "./merge";
import type { MediaInfo } from "../../../types/media";

const baseInfo: MediaInfo = {
  duration: 30,
  width: 1920,
  height: 1080,
  video_codec: "h264",
  video_codec_long: null,
  video_profile: null,
  video_bitrate: null,
  aspect_ratio: "16:9",
  pix_fmt: "yuv420p",
  color_space: null,
  frame_count: null,
  audio_codec: "aac",
  audio_codec_long: null,
  audio_bitrate: null,
  audio_sample_rate: 48000,
  audio_channels: 2,
  channel_layout: "stereo",
  sample_fmt: null,
  fps: 30,
  size_bytes: null,
  format: "mp4",
  format_long: null,
  stream_count: 2,
  creation_time: null,
  encoder: null,
};

describe("overlay", () => {
  it("merge.videoInputs = 2, аудио не задействует", () => {
    expect(overlay.merge?.videoInputs).toBe(2);
    expect(overlay.merge?.audioInputs).toBeUndefined();
  });

  it("toComplex: [main][ov]overlay=x:y[vout]", () => {
    const fragment = overlay.merge!.toComplex({
      vIn: ["0:v", "1:v"],
      aIn: [],
      vOut: "vout",
      params: { x: 10, y: 20 },
    });
    expect(fragment).toBe("[0:v][1:v]overlay=10:20[vout]");
  });

  it("applyMerge: размер = размер основного видео", () => {
    const secondary: MediaInfo = { ...baseInfo, width: 320, height: 240 };
    const r = overlay.merge!.applyMerge!(baseInfo, secondary, { x: 0, y: 0 });
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });
});

describe("concat", () => {
  it("merge: 2 видео + 2 аудио входа", () => {
    expect(concat.merge?.videoInputs).toBe(2);
    expect(concat.merge?.audioInputs).toBe(2);
  });

  it("toComplex: concat=n=2:v=1:a=1 с двумя выходами", () => {
    const fragment = concat.merge!.toComplex({
      vIn: ["0:v", "1:v"],
      aIn: ["0:a", "1:a"],
      vOut: "vout",
      aOut: "aout",
      params: {},
    });
    expect(fragment).toBe("[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[vout][aout]");
  });

  it("applyMerge: длительность = сумма двух роликов", () => {
    const secondary: MediaInfo = { ...baseInfo, duration: 15 };
    const r = concat.merge!.applyMerge!(baseInfo, secondary, {});
    expect(r.duration).toBe(45); // 30 + 15
  });

  it("applyMerge: если у второго нет длительности — берём первую", () => {
    const secondary: MediaInfo = { ...baseInfo, duration: null };
    const r = concat.merge!.applyMerge!(baseInfo, secondary, {});
    expect(r.duration).toBe(30);
  });
});
