// Тесты предсказания характеристик результата (см. docs/ARCHITECTURE.md §4, §9).
import { describe, it, expect } from "vitest";
import { predictOutput } from "./predict";
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";
import type { MediaInfo } from "../../types/media";

const node = (id: string, kind: GraphNode["kind"], filterId?: string, params = {}): GraphNode => ({
  id,
  kind,
  filterId,
  params,
  position: { x: 0, y: 0 },
});
const edge = (source: string, target: string): GraphEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

// Типичный вход 1080p/30fps/60с
const input: MediaInfo = {
  duration: 60,
  width: 1920,
  height: 1080,
  video_codec: "h264",
  video_codec_long: "H.264 / AVC",
  video_profile: "High",
  video_bitrate: 8_000_000,
  aspect_ratio: "16:9",
  pix_fmt: "yuv420p",
  color_space: "bt709",
  frame_count: 1800,
  audio_codec: "aac",
  audio_codec_long: "AAC (Advanced Audio Coding)",
  audio_bitrate: 320_000,
  audio_sample_rate: 48_000,
  audio_channels: 2,
  channel_layout: "stereo",
  sample_fmt: "fltp",
  fps: 30,
  size_bytes: 50_000_000,
  format: "mov,mp4,m4a,3gp,3g2,mj2",
  format_long: "QuickTime / MOV",
  stream_count: 2,
  creation_time: "2026-06-14T20:50:24.000000Z",
  encoder: "DaVinci Resolve",
};

const chain = (...filters: GraphNode[]): Graph => {
  const nodes = [node("in", "input"), ...filters, node("out", "output")];
  const ids = ["in", ...filters.map((f) => f.id), "out"];
  const edges: GraphEdge[] = ids.slice(0, -1).map((s, i) => edge(s, ids[i + 1]));
  return { nodes, edges };
};

describe("predictOutput", () => {
  it("нет входа → null", () => {
    expect(predictOutput(chain(), null)).toBeNull();
  });

  it("пустая цепочка (input→output) → вход без изменений", () => {
    expect(predictOutput(chain(), input)).toEqual(input);
  });

  it("оборванная цепочка → null", () => {
    const graph: Graph = {
      nodes: [node("in", "input"), node("f", "filter", "scale"), node("out", "output")],
      edges: [edge("in", "f")],
    };
    expect(predictOutput(graph, input)).toBeNull();
  });

  it("scale: меняет разрешение, высота -2 считается по пропорциям входа", () => {
    const r = predictOutput(chain(node("f", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 })), input);
    // 1280 при соотношении 16:9 → высота 720
    expect(r?.width).toBe(1280);
    expect(r?.height).toBe(720);
  });

  it("fps: меняет только частоту кадров", () => {
    const r = predictOutput(chain(node("f", "filter", "fps", { value: 15 })), input);
    expect(r?.fps).toBe(15);
    expect(r?.width).toBe(1920);
  });

  it("trim: длительность = конец − начало", () => {
    const r = predictOutput(chain(node("f", "filter", "trim", { start: 5, end: 20 })), input);
    expect(r?.duration).toBe(15);
  });

  it("speed ×2: длительность вдвое короче", () => {
    const r = predictOutput(chain(node("f", "filter", "speed", { factor: 2 })), input);
    expect(r?.duration).toBe(30);
  });

  it("rotate 90°: меняет ширину и высоту местами", () => {
    const r = predictOutput(
      chain(node("f", "filter", "rotate", { angle: "90° по часовой" })),
      input,
    );
    expect(r?.width).toBe(1080);
    expect(r?.height).toBe(1920);
  });

  it("rotate 180°: разрешение не меняется", () => {
    const r = predictOutput(chain(node("f", "filter", "rotate", { angle: "180°" })), input);
    expect(r?.width).toBe(1920);
    expect(r?.height).toBe(1080);
  });

  it("фильтр без applyToInfo (отражение) ничего не меняет", () => {
    const r = predictOutput(chain(node("f", "filter", "flip", { dir: "Горизонтально" })), input);
    expect(r).toEqual(input);
  });

  it("цепочка scale → fps → trim считается по порядку", () => {
    const r = predictOutput(
      chain(
        node("a", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 }),
        node("b", "filter", "fps", { value: 24 }),
        node("c", "filter", "trim", { start: 0, end: 10 }),
      ),
      input,
    );
    expect(r?.width).toBe(1280);
    expect(r?.height).toBe(720);
    expect(r?.fps).toBe(24);
    expect(r?.duration).toBe(10);
  });

  it("извлечь аудио: видеохарактеристики обнуляются", () => {
    const r = predictOutput(chain(node("f", "filter", "extract_audio", {})), input);
    expect(r?.video_codec).toBeNull();
    expect(r?.width).toBeNull();
    expect(r?.audio_codec).toBe("aac");
  });

  it("GIF: формат gif, без звука, своя ширина/fps", () => {
    const r = predictOutput(chain(node("f", "filter", "to_gif", { fps: 12, width: 480 })), input);
    expect(r?.format).toBe("gif");
    expect(r?.audio_codec).toBeNull();
    expect(r?.fps).toBe(12);
    expect(r?.width).toBe(480);
    expect(r?.height).toBe(270); // 480 при 16:9
  });

  it("не мутирует входной объект", () => {
    const snapshot = { ...input };
    predictOutput(chain(node("f", "filter", "scale", { preset: "Свои размеры", width: 640, height: 360 })), input);
    expect(input).toEqual(snapshot);
  });
});
