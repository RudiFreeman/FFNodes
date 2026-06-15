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

// Битрейт (бит/с) → "7.0 Мбит/с" или "128 кбит/с"
export function formatBitrate(bps: number | null): string {
  if (bps == null || bps <= 0) return "—";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Мбит/с`;
  return `${Math.round(bps / 1000)} кбит/с`;
}

// Частота дискретизации (Гц) → "48 кГц"
export function formatSampleRate(hz: number | null): string {
  if (hz == null || hz <= 0) return "—";
  return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} кГц`;
}

// Число каналов → "Стерео" / "Моно" / "5.1" (приближённо)
export function formatChannels(ch: number | null): string {
  if (ch == null || ch <= 0) return "—";
  if (ch === 1) return "Моно";
  if (ch === 2) return "Стерео";
  if (ch === 6) return "5.1";
  if (ch === 8) return "7.1";
  return `${ch} кан.`;
}

// Битность цвета из формата пикселей: yuv420p10le → "10 бит", yuv420p → "8 бит"
export function bitDepthFromPixFmt(pixFmt: string | null): string | null {
  if (!pixFmt) return null;
  const m = pixFmt.match(/p(\d{1,2})(le|be)?$/);
  return m ? `${m[1]} бит` : "8 бит";
}

// ISO-дата создания → "14.06.2026 20:50". Возвращает null, если не распарсилась.
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Имя файла из полного пути (кроссплатформенно: и / и \)
export function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
