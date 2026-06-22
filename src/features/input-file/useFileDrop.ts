// Подписка на drag&drop файлов в окно (Tauri v2). Webview перехватывает нативное
// перетаскивание и отдаёт АБСОЛЮТНЫЕ пути файлов — это не команда, доп. permissions не нужны.
// События глобальны для окна; пока зона перетаскивания одна (панель превью), грузим в
// основной вход. Возвращает { dragging } для подсветки зоны. См. docs/ARCHITECTURE.md §6.
import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

// onDrop получает путь первого перетащенного файла (батч — позже).
export function useFileDrop(onDrop: (path: string) => void) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // onDragDropEvent возвращает промис с функцией отписки; вызываем её в cleanup.
    const unlistenPromise = getCurrentWebview().onDragDropEvent((event) => {
      const { type } = event.payload;
      if (type === "enter" || type === "over") {
        setDragging(true);
      } else if (type === "drop") {
        setDragging(false);
        const path = event.payload.paths[0];
        if (path) onDrop(path);
      } else {
        // "leave" — курсор ушёл из окна без сброса
        setDragging(false);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onDrop]);

  return { dragging };
}
