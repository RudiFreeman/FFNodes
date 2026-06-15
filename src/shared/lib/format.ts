// Человекочитаемое форматирование значений для UI.

// Секунды → "1:05" или "0:09"
export function formatDuration(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Байты → "51.3 МБ"
export function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Имя файла из полного пути (кроссплатформенно: и / и \)
export function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
