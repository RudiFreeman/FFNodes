// Панель превью (слева): вход и результат, плеер, переключатель до/после.
// Пока заглушка с пустым состоянием. См. docs/UI.md §4–5 (PreviewPanel, EmptyState).
import { FileVideo } from "lucide-react";

export function PreviewPanel() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        Превью
      </div>

      {/* Пустое состояние — приглашение перетащить файл */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        <FileVideo className="h-10 w-10 text-fg-muted" aria-hidden />
        <p className="text-sm text-fg-muted">
          Перетащи сюда видео,
          <br />
          чтобы начать
        </p>
      </div>
    </aside>
  );
}
