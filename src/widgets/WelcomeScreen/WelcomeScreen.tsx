// Приветственный экран (Спринт 5): первая точка входа вместо сразу пустого холста.
// Показывается при холодном старте. Даёт три действия: Новый проект / Открыть проект /
// открыть один из недавних. Чистая презентация — вся механика (создание/открытие/список
// недавних) живёт в App и приходит колбэками; компонент состояния не держит.
// Дизайн-токены темы — tailwind.config.js (bg/surface/accent/fg). См. docs/UI.md.
import { Clapperboard, FilePlus, FolderOpen, History } from "lucide-react";
import { basename } from "../../shared/lib/format";
import type { RecentProject } from "../TopBar/RecentMenu";

interface WelcomeScreenProps {
  recent: RecentProject[]; // список последних проектов (useRecentProjects)
  onNew: () => void; // создать новый проект — чистый холст
  onOpen: () => void; // открыть проект через системный диалог
  onOpenRecent: (path: string) => void; // открыть недавний по его пути
}

export function WelcomeScreen({ recent, onNew, onOpen, onOpenRecent }: WelcomeScreenProps) {
  return (
    <div className="flex h-screen items-center justify-center overflow-auto bg-bg text-fg">
      <div className="w-full max-w-md px-6 py-10">
        {/* Бренд — как в шапке (TopBar) */}
        <div className="mb-8 flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-accent" aria-hidden />
          <span className="text-lg font-semibold">FFNodes</span>
        </div>

        {/* Два главных действия */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-2.5 rounded-lg bg-accent px-4 py-3 text-left text-sm font-medium text-on-accent transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <FilePlus className="h-5 w-5" aria-hidden />
            <span>
              <span className="block">Новый проект</span>
              <span className="block text-xs font-normal text-on-accent/70">
                Пустой холст — добавь файл и собери пайплайн
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <FolderOpen className="h-5 w-5 text-fg-muted" aria-hidden />
            <span>
              <span className="block">Открыть проект</span>
              <span className="block text-xs font-normal text-fg-muted">
                Загрузить сохранённый .ffvproj
              </span>
            </span>
          </button>
        </div>

        {/* Недавние проекты */}
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
            <History className="h-3.5 w-3.5" aria-hidden />
            Недавние
          </div>
          {recent.length === 0 ? (
            <p className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-fg-muted">
              Пока нет недавних проектов
            </p>
          ) : (
            <ul className="overflow-hidden rounded-md border border-border bg-surface">
              {recent.map((p) => (
                <li key={p.path} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onOpenRecent(p.path)}
                    className="block w-full px-3 py-2 text-left transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
                    title={p.path}
                  >
                    <span className="block truncate text-sm text-fg">
                      {p.name || basename(p.path)}
                    </span>
                    <span className="block truncate text-xs text-fg-muted">{p.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
