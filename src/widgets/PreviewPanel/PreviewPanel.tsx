// Панель превью (слева): выбор входного файла + метаданные под ним (ffprobe).
// См. docs/UI.md §4 (зона «Превью»), docs/ARCHITECTURE.md §7.
import { FileVideo, FolderOpen } from "lucide-react";
import type { MediaInfo } from "../../shared/api/tauri";
import { formatBytes, formatDuration, basename } from "../../shared/lib/format";

interface PreviewPanelProps {
  path: string | null;
  info: MediaInfo | null;
  loading: boolean;
  error: string | null;
  onChoose: () => void;
}

// Одна строка метаданных «label: value»
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 text-xs">
      <span className="text-fg-muted">{label}</span>
      <span className="truncate text-fg" title={value}>
        {value}
      </span>
    </div>
  );
}

export function PreviewPanel({ path, info, loading, error, onChoose }: PreviewPanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        Превью
      </div>

      {!path ? (
        // Пустое состояние — приглашение выбрать файл
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <FileVideo className="h-10 w-10 text-fg-muted" aria-hidden />
          <p className="text-sm text-fg-muted">Выбери видео, чтобы начать</p>
          <button
            type="button"
            onClick={onChoose}
            className="flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1.5 text-sm text-fg transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
            Открыть файл
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Заглушка плеера (реальное видео-превью — позже) */}
          <div className="flex aspect-video items-center justify-center border-b border-border bg-bg">
            <FileVideo className="h-8 w-8 text-fg-muted" aria-hidden />
          </div>

          {/* Имя файла + кнопка сменить */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="truncate text-sm text-fg" title={path}>
              {basename(path)}
            </span>
            <button
              type="button"
              onClick={onChoose}
              aria-label="Выбрать другой файл"
              className="shrink-0 text-fg-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <FolderOpen className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Метаданные файла */}
          <div className="px-3 py-2">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted">
              Характеристики
            </div>
            {loading && <p className="text-xs text-fg-muted">Читаю файл…</p>}
            {error && <p className="text-xs text-destructive">Не удалось прочитать файл</p>}
            {info && (
              <div>
                <MetaRow
                  label="Разрешение"
                  value={info.width && info.height ? `${info.width}×${info.height}` : "—"}
                />
                <MetaRow label="Длительность" value={formatDuration(info.duration)} />
                <MetaRow label="FPS" value={info.fps ? String(Math.round(info.fps)) : "—"} />
                <MetaRow label="Видео" value={info.video_codec ?? "—"} />
                <MetaRow label="Аудио" value={info.audio_codec ?? "—"} />
                <MetaRow label="Размер" value={formatBytes(info.size_bytes)} />
                <MetaRow label="Формат" value={info.format ?? "—"} />
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
