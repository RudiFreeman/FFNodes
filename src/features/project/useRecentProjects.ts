// Список последних проектов (Спринт 4, пункт 4): хранится в app-config/recent.json через
// Rust (read_recent/write_recent). Задел под приветственное окно — пока только выпадашка
// «Недавние» в топбаре. Запись добавляется при сохранении/открытии проекта.
import { useCallback, useEffect, useState } from "react";
import { readRecent, writeRecent } from "../../shared/api/projects";
import type { RecentProject } from "../../widgets/TopBar/RecentMenu";

const MAX_RECENT = 10; // сколько проектов помним

export function useRecentProjects() {
  const [recent, setRecent] = useState<RecentProject[]>([]);

  // Прочитать список при старте. Файла нет/битый — пустой список (read_recent отдаёт "[]").
  useEffect(() => {
    let alive = true;
    readRecent()
      .then((text) => {
        const parsed = parseRecent(text);
        if (alive) setRecent(parsed);
      })
      .catch(() => {
        /* нет файла/ошибка чтения — просто пустой список */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Добавить/поднять проект наверх списка и сохранить на диск.
  const remember = useCallback((path: string, name: string) => {
    setRecent((prev) => {
      const without = prev.filter((p) => p.path !== path); // дубль убираем
      const next = [{ path, name, openedAt: Date.now() }, ...without].slice(0, MAX_RECENT);
      // запись на диск — fire-and-forget (ошибку не показываем, список не критичен)
      void writeRecent(JSON.stringify(next));
      return next;
    });
  }, []);

  // Убрать запись (например, проект не открылся — файл пропал).
  const forget = useCallback((path: string) => {
    setRecent((prev) => {
      const next = prev.filter((p) => p.path !== path);
      void writeRecent(JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, remember, forget };
}

// Разобрать JSON списка с защитой от мусора (не наш формат → пустой список).
function parseRecent(text: string): RecentProject[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is RecentProject =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as RecentProject).path === "string" &&
      typeof (p as RecentProject).name === "string",
  );
}
