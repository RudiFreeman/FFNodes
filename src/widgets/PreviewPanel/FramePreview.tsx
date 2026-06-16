// Превью-кадр в панели: крупный кадр + переключатель «До»/«После».
// Кадры приходят готовыми URL (asset-протокол) из usePreviewFrame. Этот компонент —
// только отображение и переключение. См. docs/UI.md §4.
import { useEffect, useState } from "react";
import { FileVideo, Loader2 } from "lucide-react";

interface FramePreviewProps {
  before: string | null;
  after: string | null;
  loadingBefore: boolean;
  loadingAfter: boolean;
  error: string | null;
  // Есть ли вообще разница «После» (есть фильтры) — иначе переключатель не нужен
  hasAfter: boolean;
}

type View = "before" | "after";

export function FramePreview({
  before,
  after,
  loadingBefore,
  loadingAfter,
  error,
  hasAfter,
}: FramePreviewProps) {
  const [view, setView] = useState<View>("before");

  // Если фильтров не стало — вернуться на «До» (вкладки «После» больше нет)
  useEffect(() => {
    if (!hasAfter) setView("before");
  }, [hasAfter]);

  const src = view === "after" ? after : before;
  const loading = view === "after" ? loadingAfter : loadingBefore;

  return (
    <div className="border-b border-border bg-bg">
      {/* Сам кадр */}
      <div className="relative flex aspect-video items-center justify-center overflow-hidden">
        {src ? (
          <img src={src} alt={view === "after" ? "Кадр после" : "Кадр до"} className="h-full w-full object-contain" />
        ) : error ? (
          <div className="flex flex-col items-center gap-1.5 text-center text-fg-muted">
            <FileVideo className="h-8 w-8" aria-hidden />
            <span className="px-3 text-xs">Не удалось получить кадр</span>
          </div>
        ) : (
          <FileVideo className="h-8 w-8 text-fg-muted" aria-hidden />
        )}

        {/* Оверлей загрузки — поверх старого кадра, чтобы не моргало пустотой */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/50">
            <Loader2 className="h-5 w-5 animate-spin text-fg-muted" aria-hidden />
          </div>
        )}
      </div>

      {/* Переключатель До/После — только когда есть что сравнивать */}
      {hasAfter && (
        <div className="flex border-t border-border text-xs">
          <button
            type="button"
            onClick={() => setView("before")}
            className={`flex-1 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              view === "before" ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            До
          </button>
          <button
            type="button"
            onClick={() => setView("after")}
            className={`flex-1 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
              view === "after" ? "bg-surface-2 text-accent" : "text-fg-muted hover:text-fg"
            }`}
          >
            После
          </button>
        </div>
      )}
    </div>
  );
}
