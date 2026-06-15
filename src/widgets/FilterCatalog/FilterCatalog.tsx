// Каталог функций (справа): поиск + категории с человеческими описаниями «что и зачем».
// На этапе каркаса — статичные демо-категории. Реально каталог рендерится из данных
// (src/shared/lib/ffmpeg/catalog/), см. docs/ARCHITECTURE.md §3.
import { Search } from "lucide-react";

// Демо-данные для каркаса (потом — из каталога-данных)
const DEMO_CATEGORIES = [
  { name: "Конвертация", items: ["Сменить формат", "Сжать видео"] },
  { name: "Размер / FPS", items: ["Изменить размер", "Сменить частоту кадров"] },
  { name: "Обрезка", items: ["Обрезать по времени", "Кадрировать"] },
  { name: "Экспорт", items: ["Сделать GIF", "Извлечь аудио"] },
];

export function FilterCatalog() {
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
            placeholder="Поиск функции…"
            className="w-full bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Категории (демо) */}
      <div className="flex-1 overflow-y-auto p-2">
        {DEMO_CATEGORIES.map((cat) => (
          <div key={cat.name} className="mb-3">
            <div className="mb-1 px-1 text-xs font-medium text-fg-muted">
              {cat.name}
            </div>
            {cat.items.map((item) => (
              <button
                key={item}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {item}
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
