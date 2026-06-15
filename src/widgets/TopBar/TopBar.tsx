// Шапка приложения: бренд, имя проекта, настройки и главный CTA «Рендер».
// См. docs/UI.md §4 (TopBar). Render — единственный яркий (зелёный) CTA на экране.
import { Settings, Play, Clapperboard } from "lucide-react";

export function TopBar() {
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
        <button
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
          type="button"
        >
          <Play className="h-4 w-4" aria-hidden />
          Рендер
        </button>
      </div>
    </header>
  );
}
