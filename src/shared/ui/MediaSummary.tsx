// Компактная сводка характеристик медиа — для нод «Вход» и «Выход» на холсте.
// Базовый набор (по UX-договорённости): разрешение, FPS, кодек, размер.
// Размер помечается «≈», т.к. до рендера это оценка (точно его предсказать нельзя).
import type { MediaInfo } from "../types/media";
import { formatBytes } from "../lib/format";

interface MediaSummaryProps {
  info: MediaInfo | null;
  // approxSize=true — размер показывается со значком «≈» (оценка, не реальный файл)
  approxSize?: boolean;
}

export function MediaSummary({ info, approxSize = true }: MediaSummaryProps) {
  if (!info) {
    return <div className="mt-1 text-xs text-fg-muted">—</div>;
  }

  const resolution =
    info.width && info.height ? `${info.width}×${info.height}` : null;
  const fps = info.fps ? `${Math.round(info.fps)} fps` : null;
  const size = info.size_bytes != null ? formatBytes(info.size_bytes) : null;

  // Строка «подпись: значение» с тусклой подписью — чтобы было понятно, что есть что
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-fg-muted/60">{label}</span>
      <span className="text-fg-muted">{value}</span>
    </div>
  );

  return (
    <div className="mt-1.5 space-y-0.5 text-[11px] leading-tight">
      {resolution && <Row label="разрешение" value={resolution} />}
      {fps && <Row label="кадры" value={fps} />}
      {info.video_codec && <Row label="кодек" value={info.video_codec} />}
      {size && <Row label="размер" value={approxSize ? `≈ ${size}` : size} />}
    </div>
  );
}
