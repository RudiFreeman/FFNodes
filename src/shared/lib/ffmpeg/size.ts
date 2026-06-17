// Оценка размера выходного файла (N-010). Чистые функции, без побочных эффектов.
// Размер ≈ (video_bitrate + audio_bitrate) × duration / 8 (бит → байты). Это ОЦЕНКА:
// реальный размер зависит от контента, кодека и кодировщика. В UI помечается «≈».
// Битрейт корректируют сами операции в applyToInfo (scale/fps — ∝ пикселям/fps; compress/
// codec — от CRF, см. ниже). Здесь — только сборка размера и эмпирика CRF→битрейт.
import type { MediaInfo } from "../../types/media";

// Оценить размер из итоговых битрейтов и длительности. Если данных не хватает
// (нет битрейтов или длительности) — возвращаем прежний size_bytes (честнее, чем угадывать).
export function estimateSize(info: MediaInfo): number | null {
  if (info.duration == null || info.duration <= 0) return info.size_bytes;
  const v = info.video_bitrate ?? 0;
  const a = info.audio_bitrate ?? 0;
  const totalBitrate = v + a;
  if (totalBitrate <= 0) return info.size_bytes; // нечего оценивать
  // бит/с × сек = биты; /8 = байты
  return Math.round((totalBitrate * info.duration) / 8);
}

// Масштабировать видеобитрейт пропорционально изменению числа пикселей в секунду.
// Физика: при том же качестве битрейт ∝ (ширина × высота × fps). Используется операциями
// scale/pad/fps в applyToInfo. Возвращает новый битрейт или null, если исходный неизвестен.
export function scaleVideoBitrate(
  oldBitrate: number | null,
  oldW: number | null,
  oldH: number | null,
  oldFps: number | null,
  newW: number | null,
  newH: number | null,
  newFps: number | null,
): number | null {
  if (oldBitrate == null) return null;
  const oldPixels = (oldW ?? 0) * (oldH ?? 0) * (oldFps ?? 1);
  const newPixels = (newW ?? 0) * (newH ?? 0) * (newFps ?? 1);
  if (oldPixels <= 0 || newPixels <= 0) return oldBitrate; // не можем оценить — без изменений
  return Math.round(oldBitrate * (newPixels / oldPixels));
}

// Оценить видеобитрейт по CRF и разрешению/fps (для compress/changeCodec, где битрейт задаётся
// не напрямую, а целевым качеством). Грубая эмпирика H.264: при CRF≈23 на 1080p30 битрейт
// порядка ~0.1 бит/пиксель/кадр; ниже CRF (выше качество) — больше, выше CRF — меньше.
// Шаг 6 единиц CRF ≈ удвоение/деление битрейта вдвое (известное правило H.264).
// Это приближение — точный битрейт зависит от контента; в UI всё равно «≈».
export function estimateBitrateFromCrf(
  width: number | null,
  height: number | null,
  fps: number | null,
  crf: number,
): number | null {
  if (!width || !height) return null;
  const f = fps && fps > 0 ? fps : 30;
  // База: ~0.08 бит на пиксель в кадр при CRF 23 — даёт ~5 Мбит/с на 1080p30
  // (1920×1080×0.08×30 ≈ 4.98 Мбит/с), что соответствует типичному H.264/web
  // (эмпирика; точный битрейт зависит от контента).
  const BITS_PER_PIXEL_AT_CRF23 = 0.08;
  const CRF_REFERENCE = 23;
  // Каждые +6 CRF делят битрейт вдвое; −6 — удваивают (известное правило H.264)
  const factor = Math.pow(2, (CRF_REFERENCE - crf) / 6);
  const bitsPerFrame = width * height * BITS_PER_PIXEL_AT_CRF23 * factor;
  return Math.round(bitsPerFrame * f);
}
