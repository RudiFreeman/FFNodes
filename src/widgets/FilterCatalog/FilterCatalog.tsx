// Каталог функций (справа): поиск + «Избранное» (всегда открыто) + сворачиваемые
// группы-аккордеоны (по умолчанию свёрнуты). Звёздочки — как эффекты в Premiere.
// См. docs/ARCHITECTURE.md §3, docs/UI.md §4.
import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, Star } from "lucide-react";
import { catalogByCategory, CATALOG, type FilterDef } from "../../shared/lib/ffmpeg/catalog";
import { CatalogItem } from "./CatalogItem";

interface FilterCatalogProps {
  onAddFilter: (def: FilterDef) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

export function FilterCatalog({
  onAddFilter,
  isFavorite,
  onToggleFavorite,
}: FilterCatalogProps) {
  const [query, setQuery] = useState("");
  // Развёрнутые категории. По умолчанию ВСЕ свёрнуты (функций много) — пустое множество.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Избранное по умолчанию открыто (в отличие от категорий), но сворачивается вручную.
  const [favOpen, setFavOpen] = useState(true);

  const toggle = (category: string) =>
    setExpanded((prev) => {
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

  // Избранные функции (в порядке каталога), отфильтрованные по поиску
  const favoriteItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter(
      (f) =>
        isFavorite(f.id) &&
        (!q ||
          f.label.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)),
    );
  }, [query, isFavorite]);

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

      <div className="flex-1 overflow-y-auto p-2">
        {/* Избранное — открыто по умолчанию, сворачивается вручную; отделено полосой снизу */}
        {favoriteItems.length > 0 && (
          <div className="mb-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setFavOpen((v) => !v)}
              className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-accent transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {searching || favOpen ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              )}
              <Star className="h-3.5 w-3.5 fill-accent" aria-hidden />
              Избранное
              <span className="ml-auto text-fg-muted">{favoriteItems.length}</span>
            </button>
            {(searching || favOpen) &&
              favoriteItems.map((def) => (
                <CatalogItem
                  key={`fav-${def.id}`}
                  def={def}
                  isFavorite
                  onAdd={onAddFilter}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
          </div>
        )}

        {/* Категории-аккордеоны (по умолчанию свёрнуты) */}
        {groups.length === 0 && favoriteItems.length === 0 && (
          <p className="px-1 py-2 text-sm text-fg-muted">Ничего не найдено</p>
        )}
        {groups.map((g) => {
          // При поиске показываем найденное; иначе — по флагу развёрнутости
          const isOpen = searching || expanded.has(g.category);
          return (
            <div key={g.category} className="mb-1">
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
                  <CatalogItem
                    key={def.id}
                    def={def}
                    isFavorite={isFavorite(def.id)}
                    onAdd={onAddFilter}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
