// Каталог функций (справа): поиск + сворачиваемые группы-аккордеоны с человеческими
// описаниями «что и зачем». Рендерится из данных каталога. Клик по пункту → нода на холсте.
// См. docs/ARCHITECTURE.md §3, docs/UI.md §4.
import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import {
  catalogByCategory,
  type FilterDef,
} from "../../shared/lib/ffmpeg/catalog";

interface FilterCatalogProps {
  onAddFilter: (def: FilterDef) => void;
}

export function FilterCatalog({ onAddFilter }: FilterCatalogProps) {
  const [query, setQuery] = useState("");
  // Свёрнутые категории (по умолчанию все развёрнуты — пустое множество)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (category: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });

  // Группируем каталог и фильтруем по поисковому запросу (по имени и описанию)
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogByCategory()
      .map((g) => ({
        ...g,
        items: q
          ? g.items.filter(
              (f) =>
                f.label.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q),
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const searching = query.trim().length > 0;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        Каталог функций
      </div>

      {/* Поиск */}
      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-2.5 py-1.5">
          <Search className="h-4 w-4 text-fg-muted" aria-hidden />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск функции…"
            className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Категории-аккордеоны из каталога-данных */}
      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="px-1 py-2 text-sm text-fg-muted">Ничего не найдено</p>
        )}
        {groups.map((g) => {
          // При поиске всегда показываем найденное (игнорируем свёрнутость)
          const isOpen = searching || !collapsed.has(g.category);
          return (
            <div key={g.category} className="mb-2">
              <button
                type="button"
                onClick={() => toggle(g.category)}
                className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-fg-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
                {g.category}
                <span className="ml-auto text-fg-muted">{g.items.length}</span>
              </button>

              {isOpen &&
                g.items.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    title={def.description}
                    onClick={() => onAddFilter(def)}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="text-fg">{def.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-muted">
                      {def.description}
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
