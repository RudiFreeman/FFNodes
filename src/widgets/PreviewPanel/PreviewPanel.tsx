// Панель превью (слева): выбор входного файла + метаданные До/После (ffprobe).
// См. docs/UI.md §4 (зона «Превью»), docs/ARCHITECTURE.md §7.
import { Fragment } from "react";
import { FileVideo, FolderOpen } from "lucide-react";
import type { MediaInfo } from "../../shared/api/tauri";
import { FramePreview } from "./FramePreview";
import type { PreviewFrameState } from "../../features/preview-frame/usePreviewFrame";
import {
  formatBytes,
  formatDuration,
  formatBitrate,
  formatSampleRate,
  formatChannels,
  bitDepthFromPixFmt,
  formatDate,
  basename,
} from "../../shared/lib/format";

interface PreviewPanelProps {
  path: string | null;
  info: MediaInfo | null;
  loading: boolean;
  error: string | null;
  outputInfo: MediaInfo | null; // характеристики «После»: предсказание или результат рендера
  rendered: boolean; // true — outputInfo это реальный результат рендера (размер точный, не «≈»)
  frame: PreviewFrameState; // кадры «До»/«После» (usePreviewFrame)
  onChoose: () => void;
}

// Одна строка характеристики: подпись + как достать значение из MediaInfo.
// hideAfter — строка только про исходный файл (энкодер, дата): «После» не показываем,
// значение «До» растягиваем на колонки.
interface Row {
  label: string;
  get: (info: MediaInfo) => string;
  hideAfter?: boolean;
}

// Показать значение или «—», скрыв пустые. Возвращает строку.
const orDash = (v: string | null | undefined) => (v && v.length > 0 ? v : "—");
// Группа строк с заголовком — для читабельности (Видео / Звук / Файл)
interface RowGroup {
  title: string;
  rows: Row[];
}

const GROUPS: RowGroup[] = [
  {
    title: "Видео",
    rows: [
      { label: "Разрешение", get: (i) => (i.width && i.height ? `${i.width}×${i.height}` : "—") },
      { label: "Соотношение", get: (i) => orDash(i.aspect_ratio) },
      { label: "FPS", get: (i) => (i.fps ? String(Math.round(i.fps)) : "—") },
      { label: "Кадров", get: (i) => (i.frame_count != null ? String(i.frame_count) : "—") },
      { label: "Кодек", get: (i) => orDash(i.video_codec) },
      { label: "Профиль", get: (i) => orDash(i.video_profile) },
      { label: "Битрейт", get: (i) => formatBitrate(i.video_bitrate) },
      { label: "Пиксели", get: (i) => orDash(i.pix_fmt) },
      { label: "Глубина", get: (i) => orDash(bitDepthFromPixFmt(i.pix_fmt)) },
      { label: "Цвет", get: (i) => orDash(i.color_space) },
    ],
  },
  {
    title: "Звук",
    rows: [
      { label: "Кодек", get: (i) => orDash(i.audio_codec) },
      { label: "Битрейт", get: (i) => formatBitrate(i.audio_bitrate) },
      { label: "Частота", get: (i) => formatSampleRate(i.audio_sample_rate) },
      { label: "Каналы", get: (i) => formatChannels(i.audio_channels) },
      { label: "Раскладка", get: (i) => orDash(i.channel_layout) },
      { label: "Сэмплы", get: (i) => orDash(i.sample_fmt) },
    ],
  },
  {
    title: "Файл",
    rows: [
      { label: "Длительность", get: (i) => formatDuration(i.duration) },
      { label: "Формат", get: (i) => orDash(i.format_long ?? i.format) },
      { label: "Размер", get: (i) => formatBytes(i.size_bytes) },
      { label: "Потоков", get: (i) => (i.stream_count != null ? String(i.stream_count) : "—"), hideAfter: true },
      { label: "Энкодер", get: (i) => orDash(i.encoder), hideAfter: true },
      { label: "Создан", get: (i) => orDash(formatDate(i.creation_time)), hideAfter: true },
    ],
  },
];

export function PreviewPanel({
  path,
  info,
  loading,
  error,
  outputInfo,
  rendered,
  frame,
  onChoose,
}: PreviewPanelProps) {
  // «После» отличается от «До» только когда кадр после реально получен и не равен «До»
  const hasAfter = frame.after !== null && frame.after !== frame.before;
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        Превью
      </div>

      {!path ? (
        // Пустое состояние — приглашение выбрать файл
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <FileVideo className="h-10 w-10 text-fg-muted" aria-hidden />
          <p className="text-sm text-fg-muted">Выбери видео, чтобы начать</p>
          <button
            type="button"
            onClick={onChoose}
            className="flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1.5 text-sm text-fg transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
            Открыть файл
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Превью-кадр До/После (видеоплеер с проигрыванием — отдельный этап позже) */}
          <FramePreview
            before={frame.before}
            after={frame.after}
            loadingBefore={frame.loadingBefore}
            loadingAfter={frame.loadingAfter}
            error={frame.error}
            hasAfter={hasAfter}
          />

          {/* Имя файла + кнопка сменить */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="truncate text-sm text-fg" title={path}>
              {basename(path)}
            </span>
            <button
              type="button"
              onClick={onChoose}
              aria-label="Выбрать другой файл"
              className="shrink-0 text-fg-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <FolderOpen className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Метаданные — таблица До/После. Сетка: подпись | До | После (если есть) */}
          <div className="px-3 py-2">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
              Характеристики
            </div>
            {loading && <p className="text-xs text-fg-muted">Читаю файл…</p>}
            {error && <p className="text-xs text-destructive">Не удалось прочитать файл</p>}

            {info && (
              // grid: 1-я колонка под подписи, остальные — значения. cols зависит от наличия «После»
              <div
                className="grid items-baseline gap-x-2 text-xs"
                style={{
                  gridTemplateColumns: outputInfo
                    ? "minmax(0,auto) 1fr 1fr"
                    : "minmax(0,auto) 1fr",
                }}
              >
                {/* Шапка колонок До/После — выровнена по той же сетке */}
                {outputInfo && (
                  <>
                    <span />
                    <span className="pb-1 text-right text-[11px] font-medium uppercase text-fg-muted">
                      До
                    </span>
                    <span className="pb-1 text-right text-[11px] font-medium uppercase text-accent">
                      После
                    </span>
                  </>
                )}

                {GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    {/* Подзаголовок группы на всю ширину сетки, с линией сверху */}
                    <div
                      className="col-span-full mt-1.5 border-t border-border pt-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted/60"
                    >
                      {group.title}
                    </div>
                    {group.rows.map((row) => {
                      const before = row.get(info);
                      // hideAfter — строка только про исходный файл: «После» не считаем
                      let after = outputInfo && !row.hideAfter ? row.get(outputInfo) : null;
                      // Размер «После» до рендера — оценка: помечаем «≈»
                      if (after && row.label === "Размер" && !rendered) after = `≈ ${after}`;
                      // Подсветить «После», если значение отличается от «До»
                      const changed = after !== null && after.replace("≈ ", "") !== before;
                      // Если есть колонка «После», но строка hideAfter — растянуть «До» на 2 колонки
                      const spanBefore = outputInfo && row.hideAfter ? "col-span-2" : "";
                      return (
                        <Fragment key={row.label}>
                          <span className="py-1 text-fg-muted">{row.label}</span>
                          <span
                            className={`truncate py-1 text-right text-fg ${spanBefore}`}
                            title={before}
                          >
                            {before}
                          </span>
                          {after !== null && (
                            <span
                              className={`truncate py-1 text-right ${
                                changed ? "text-accent" : "text-fg-muted"
                              }`}
                              title={after}
                            >
                              {after}
                            </span>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
