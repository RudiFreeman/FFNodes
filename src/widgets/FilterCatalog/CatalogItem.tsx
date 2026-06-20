// Один пункт каталога: название + описание + звёздочка избранного.
// Клик по телу → добавить ноду; клик по звезде → переключить избранное (не добавляет ноду).
import { Star } from "lucide-react";
import type { FilterDef } from "../../shared/lib/ffmpeg/catalog";

interface CatalogItemProps {
  def: FilterDef;
  isFavorite: boolean;
  onAdd: (def: FilterDef) => void;
  onToggleFavorite: (id: string) => void;
}

export function CatalogItem({ def, isFavorite, onAdd, onToggleFavorite }: CatalogItemProps) {
  return (
    <div className="group flex items-start gap-1 rounded-md transition-colors hover:bg-surface-2">
      <button
        type="button"
        title={def.description}
        onClick={() => onAdd(def)}
        className="min-w-0 flex-1 rounded-md py-1 pl-6 pr-2 text-left focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {/* Название пункта легче заголовка группы (13px) — подпункт не перевешивает раздел.
            Крупный отступ слева (pl-6) даёт чёткую «лесенку» вложенности под заголовком группы. */}
        <span className="block text-[13px] leading-snug text-fg">{def.label}</span>
        <span className="block truncate text-[11px] leading-snug text-fg-muted">
          {def.description}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(def.id)}
        aria-label={isFavorite ? "Убрать из избранного" : "В избранное"}
        aria-pressed={isFavorite}
        className="mt-1 mr-1 shrink-0 rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Star
          className={
            isFavorite
              ? "h-4 w-4 fill-accent text-accent"
              : "h-4 w-4 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
          }
          aria-hidden
        />
      </button>
    </div>
  );
}
