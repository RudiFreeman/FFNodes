// Панель превью (слева): выбор входного файла + метаданные До/После (ffprobe).
// См. docs/UI.md §4 (зона «Превью»), docs/ARCHITECTURE.md §7.
import { FileVideo, FolderOpen } from "lucide-react";
import type { MediaInfo } from "../../shared/api/tauri";
import { formatBytes, formatDuration, basename } from "../../shared/lib/format";

interface PreviewPanelProps {
  path: string | null;
  info: MediaInfo | null;
  loading: boolean;
  error: string | null;
  outputInfo: MediaInfo | null; // метаданные результата (после рендера)
  onChoose: () => void;
}

// Список характеристик медиафайла как пары [label, value]
function mediaRows(info: MediaInfo): [string, string][] {
  return [
    ["Разрешение", info.width && info.height ? `${info.width}×${info.height}` : "—"],
    ["Длительность", formatDuration(info.duration)],
    ["FPS", info.fps ? String(Math.round(info.fps)) : "—"],
    ["Видео", info.video_codec ?? "—"],
    ["Аудио", info.audio_codec ?? "—"],
    ["Размер", formatBytes(info.size_bytes)],
    ["Формат", info.format ?? "—"],
  ];
}

export function PreviewPanel({
  path,
  info,
  loading,
  error,
  outputInfo,
  onChoose,
}: PreviewPanelProps) {
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
        <div className="flex flex-1 flex-col overflow-y-auto">
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

          {/* Метаданные. Если есть результат — две колонки До/После */}
          <div className="px-3 py-2">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
              Характеристики
            </div>
            {loading && <p className="text-xs text-fg-muted">Читаю файл…</p>}
            {error && <p className="text-xs text-destructive">Не удалось прочитать файл</p>}

            {info && (
              <div>
                {/* Заголовки колонок (показываем «После», только если есть результат) */}
                {outputInfo && (
                  <div className="mb-1 flex justify-end gap-3 text-[11px] font-medium uppercase text-fg-muted">
                    <span className="flex-1 text-right">До</span>
                    <span className="flex-1 text-right text-accent">После</span>
                  </div>
                )}
                {mediaRows(info).map(([label, before], i) => {
                  const after = outputInfo ? mediaRows(outputInfo)[i][1] : null;
                  return (
                    <div key={label} className="flex items-baseline gap-3 py-0.5 text-xs">
                      <span className="text-fg-muted">{label}</span>
                      <span className="flex-1 truncate text-right text-fg" title={before}>
                        {before}
                      </span>
                      {after !== null && (
                        <span
                          className="flex-1 truncate text-right text-accent"
                          title={after}
                        >
                          {after}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
