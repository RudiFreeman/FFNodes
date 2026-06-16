// Шапка приложения: бренд, имя проекта, настройки и главный CTA «Рендер».
// См. docs/UI.md §4 (TopBar). Render — единственный яркий (зелёный) CTA на экране.
import { Settings, Play, Clapperboard, Square } from "lucide-react";

interface TopBarProps {
  onRender: () => void;
  onCancel: () => void;
  rendering: boolean;
  canRender: boolean; // граф валиден и файл выбран
}

export function TopBar({ onRender, onCancel, rendering, canRender }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-accent" aria-hidden />
        <span className="text-sm font-semibold">FFmpeg Visual</span>
        <span className="ml-3 text-sm text-fg-muted">проект без названия</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
          type="button"
        >
          <Settings className="h-4 w-4" aria-hidden />
          Настройки
        </button>
        {rendering ? (
          // Во время рендера кнопка превращается в красную «Отмена» (kill процесса).
          // Прогресс виден в ProgressBar под шапкой.
          <button
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
            type="button"
            onClick={onCancel}
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
            Отмена
          </button>
        ) : (
          <button
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={onRender}
            disabled={!canRender}
          >
            <Play className="h-4 w-4" aria-hidden />
            Рендер
          </button>
        )}
      </div>
    </header>
  );
}
