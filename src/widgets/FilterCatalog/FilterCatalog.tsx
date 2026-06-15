// Каталог функций (справа): поиск + категории с человеческими описаниями «что и зачем».
// Рендерится из данных каталога (src/shared/lib/ffmpeg/catalog/). Клик по пункту → нода на холсте.
// См. docs/ARCHITECTURE.md §3, docs/UI.md §4.
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  catalogByCategory,
  type FilterDef,
} from "../../shared/lib/ffmpeg/catalog";

interface FilterCatalogProps {
  onAddFilter: (def: FilterDef) => void;
}

export function FilterCatalog({ onAddFilter }: FilterCatalogProps) {
  const [query, setQuery] = useState("");

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

      {/* Категории из каталога-данных */}
      <div className="flex-1 overflow-y-auto p-2">
        {groups.length === 0 && (
          <p className="px-1 py-2 text-sm text-fg-muted">Ничего не найдено</p>
        )}
        {groups.map((g) => (
          <div key={g.category} className="mb-3">
            <div className="mb-1 px-1 text-xs font-medium text-fg-muted">
              {g.category}
            </div>
            {g.items.map((def) => (
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
        ))}
      </div>
    </aside>
  );
}
