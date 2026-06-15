// Избранные функции каталога: набор id, сохраняется в localStorage между запусками.
// Как «звёздочки» эффектов в Premiere. См. docs/UI.md §4 (каталог).
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ffmpeg-visual:favorites";

// Прочитать сохранённое избранное (массив id)
function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(loadFavorites()));

  // Сохранять в localStorage при каждом изменении
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // localStorage недоступен — молча игнорируем (избранное не сохранится)
    }
  }, [favorites]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  return { favorites, isFavorite, toggleFavorite };
}
