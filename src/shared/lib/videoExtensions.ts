// Список поддерживаемых видеорасширений — единый источник для диалога выбора файла
// (pickInputFile) и drag&drop-зоны (useFileDrop). Чтобы не дублировать перечень в двух местах.
// Лежит в shared/ (а не в features/), т.к. используется из shared/api/tauri.ts — импорт идёт
// сверху вниз по слоям FSD (features → shared), не наоборот.
export const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "mkv",
  "avi",
  "webm",
  "m4v",
  "flv",
  "wmv",
] as const;

// Похож ли путь на поддерживаемое видео (по расширению, регистронезависимо).
// Используется для отсева не-видео при перетаскивании (в диалоге фильтр делает ОС).
export function isSupportedVideo(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return (VIDEO_EXTENSIONS as readonly string[]).includes(ext);
}
