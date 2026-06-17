// Тесты оценки размера файла (N-010). Чистые функции.
import { describe, it, expect } from "vitest";
import { estimateSize, scaleVideoBitrate, estimateBitrateFromCrf } from "./size";
import type { MediaInfo } from "../../types/media";

const base: MediaInfo = {
  duration: 60,
  width: 1920,
  height: 1080,
  video_codec: "h264",
  video_codec_long: null,
  video_profile: null,
  video_bitrate: 8_000_000,
  aspect_ratio: "16:9",
  pix_fmt: "yuv420p",
  color_space: null,
  frame_count: null,
  audio_codec: "aac",
  audio_codec_long: null,
  audio_bitrate: 320_000,
  audio_sample_rate: 48000,
  audio_channels: 2,
  channel_layout: "stereo",
  sample_fmt: null,
  fps: 30,
  size_bytes: 50_000_000,
  format: "mp4",
  format_long: null,
  stream_count: 2,
  creation_time: null,
  encoder: null,
};

describe("estimateSize", () => {
  it("размер = (видео+аудио битрейт) × длительность / 8", () => {
    // (8_000_000 + 320_000) × 60 / 8 = 62_400_000
    expect(estimateSize(base)).toBe(62_400_000);
  });

  it("без длительности → прежний size_bytes (не оцениваем)", () => {
    expect(estimateSize({ ...base, duration: null })).toBe(50_000_000);
  });

  it("без битрейтов → прежний size_bytes", () => {
    expect(estimateSize({ ...base, video_bitrate: null, audio_bitrate: null })).toBe(50_000_000);
  });

  it("только видеобитрейт (звук убран) → считаем по нему", () => {
    // 8_000_000 × 60 / 8 = 60_000_000
    expect(estimateSize({ ...base, audio_bitrate: null })).toBe(60_000_000);
  });
});

describe("scaleVideoBitrate", () => {
  it("уменьшение разрешения вдвое по стороне → битрейт ×1/4 (пиксели ÷4)", () => {
    // 1920×1080 → 960×540, fps тот же: пиксели/4 → битрейт/4
    expect(scaleVideoBitrate(8_000_000, 1920, 1080, 30, 960, 540, 30)).toBe(2_000_000);
  });

  it("уменьшение fps вдвое → битрейт вдвое меньше", () => {
    expect(scaleVideoBitrate(8_000_000, 1920, 1080, 30, 1920, 1080, 15)).toBe(4_000_000);
  });

  it("без исходного битрейта → null", () => {
    expect(scaleVideoBitrate(null, 1920, 1080, 30, 960, 540, 30)).toBeNull();
  });

  it("без размеров → битрейт без изменений (не можем оценить)", () => {
    expect(scaleVideoBitrate(8_000_000, null, null, 30, 960, 540, 30)).toBe(8_000_000);
  });
});

describe("estimateBitrateFromCrf", () => {
  it("CRF 23 на 1080p30 → реалистичный битрейт ~5 Мбит/с", () => {
    const b = estimateBitrateFromCrf(1920, 1080, 30, 23)!;
    // 1920×1080×0.00008×30 ≈ 4.98 Мбит/с — порядок типичного H.264/web
    expect(b).toBeGreaterThan(4_000_000);
    expect(b).toBeLessThan(6_000_000);
  });

  it("CRF +6 (29) → битрейт вдвое меньше", () => {
    const at23 = estimateBitrateFromCrf(1920, 1080, 30, 23)!;
    const at29 = estimateBitrateFromCrf(1920, 1080, 30, 29)!;
    expect(at29).toBeCloseTo(at23 / 2, -3);
  });

  it("CRF −6 (17) → битрейт вдвое больше", () => {
    const at23 = estimateBitrateFromCrf(1920, 1080, 30, 23)!;
    const at17 = estimateBitrateFromCrf(1920, 1080, 30, 17)!;
    expect(at17).toBeCloseTo(at23 * 2, -3);
  });

  it("без размеров → null", () => {
    expect(estimateBitrateFromCrf(null, null, 30, 23)).toBeNull();
  });
});
