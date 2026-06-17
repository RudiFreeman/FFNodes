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

  it("overlay: размер результата = размер основного входа (не накладки)", () => {
    // in1 (основной, 1920×1080) →[in-0] ov; in2 (накладка, 320×240) →[in-1] ov; ov → out
    const small: MediaInfo = { ...input, width: 320, height: 240 };
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("ov", "filter", "overlay", { x: 0, y: 0 }),
        node("out", "output"),
      ],
      edges: [
        { id: "1", source: "in1", target: "ov", targetHandle: "in-0" },
        { id: "2", source: "in2", target: "ov", targetHandle: "in-1" },
        { id: "3", source: "ov", target: "out" },
      ],
    };
    const infos = new Map<string, MediaInfo | null>([
      ["in1", input],
      ["in2", small],
    ]);
    const r = predictOutput(graph, input, infos);
    expect(r?.width).toBe(1920);
    expect(r?.height).toBe(1080);
  });

  it("concat: длительность результата = сумма двух роликов", () => {
    const second: MediaInfo = { ...input, duration: 20 };
    const graph: Graph = {
      nodes: [
        node("in1", "input"),
        node("in2", "input"),
        node("cc", "filter", "concat", {}),
        node("out", "output"),
      ],
      edges: [
        { id: "1", source: "in1", target: "cc", targetHandle: "in-0" },
        { id: "2", source: "in2", target: "cc", targetHandle: "in-1" },
        { id: "3", source: "cc", target: "out" },
      ],
    };
    const infos = new Map<string, MediaInfo | null>([
      ["in1", input], // 60с
      ["in2", second], // 20с
    ]);
    const r = predictOutput(graph, input, infos);
    expect(r?.duration).toBe(80); // 60 + 20
  });

  it("GIF (merge videoInputs:1) предсказывается как раньше через applyToInfo", () => {
    const r = predictOutput(chain(node("g", "filter", "to_gif", { fps: 12, width: 480 })), input);
    expect(r?.format).toBe("gif");
    expect(r?.fps).toBe(12);
    expect(r?.width).toBe(480);
  });

  it("размер (N-010): scale уменьшает разрешение → оценка размера меньше", () => {
    // 1920×1080 → 1280×720: пиксели ×(1280·720)/(1920·1080) ≈ 0.444 → битрейт и размер меньше
    const r = predictOutput(
      chain(node("f", "filter", "scale", { preset: "Свои размеры", width: 1280, height: -2 })),
      input,
    );
    expect(r?.size_bytes).not.toBeNull();
    expect(r!.size_bytes!).toBeLessThan(input.size_bytes!);
  });

  it("размер (N-010): trim уменьшает длительность → размер пропорционально меньше", () => {
    // trim 0..15 из 60с: длительность ×1/4, битрейт тот же → размер ~×1/4
    const r = predictOutput(chain(node("f", "filter", "trim", { start: 0, end: 15 })), input);
    // оценка: (8_000_000+320_000)×15/8 = 15_600_000
    expect(r?.size_bytes).toBe(15_600_000);
  });

  it("размер (N-010): операция без влияния на размер (flip) → реальный размер входа", () => {
    // flip не трогает битрейт/длительность → показываем РЕАЛЬНЫЙ size_bytes входа, не оценку
    const r = predictOutput(chain(node("f", "filter", "flip", { dir: "Горизонтально" })), input);
    expect(r?.size_bytes).toBe(input.size_bytes);
  });

  it("размер (N-010): compress (CRF 23) на 1080p → реалистичная оценка (меньше исходных 50МБ)", () => {
    // CRF-битрейт ~5 Мбит/с (вместо исходных 8) + аудио, ×60с → ~40МБ, меньше исходного
    const r = predictOutput(chain(node("f", "filter", "compress", { crf: 23 })), input);
    expect(r?.size_bytes).not.toBeNull();
    expect(r!.size_bytes!).toBeLessThan(input.size_bytes!);
    expect(r!.size_bytes!).toBeGreaterThan(10_000_000); // не абсурдно мало
  });

  it("размер (N-010): извлечь аудио → размер только по аудиобитрейту", () => {
    // видео обнулено: (0+320_000)×60/8 = 2_400_000
    const r = predictOutput(chain(node("f", "filter", "extract_audio", {})), input);
    expect(r?.size_bytes).toBe(2_400_000);
  });

  it("не мутирует входной объект", () => {
    const snapshot = { ...input };
    predictOutput(chain(node("f", "filter", "scale", { preset: "Свои размеры", width: 640, height: 360 })), input);
    expect(input).toEqual(snapshot);
  });
});
