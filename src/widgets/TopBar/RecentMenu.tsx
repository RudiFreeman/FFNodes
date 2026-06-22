// Выпадашка «Недавние» в топбаре: список последних открытых/сохранённых проектов (Спринт 4,
// пункт 4 — задел под приветственное окно). Клик по пункту открывает проект по его пути.
// Пустой список — кнопка disabled. Закрытие по клику вне меню.
import { useEffect, useRef, useState } from "react";
import { History, ChevronDown } from "lucide-react";
import { basename } from "../../shared/lib/format";

// Запись о недавнем проекте (форма совпадает с recent.json, см. useRecentProjects).
export interface RecentProject {
  path: string;
  name: string;
  openedAt: number; // unix ms — для сортировки «свежие сверху»
}

interface RecentMenuProps {
  recent: RecentProject[];
  onOpen: (path: string) => void;
}

export function RecentMenu({ recent, onOpen }: RecentMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне меню
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const disabled = recent.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
        title="Недавние проекты"
      >
        <History className="h-4 w-4" aria-hidden />
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
            Недавние
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {recent.map((p) => (
              <li key={p.path}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpen(p.path);
                  }}
                  className="block w-full truncate px-3 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
                  title={p.path}
                >
                  <span className="block truncate">{p.name || basename(p.path)}</span>
                  <span className="block truncate text-xs text-fg-muted">{p.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
