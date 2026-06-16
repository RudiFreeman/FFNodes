// Обёртки над Tauri invoke() и плагинами. См. docs/ARCHITECTURE.md §6, §8.
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { MediaInfo } from "../types/media";

// MediaInfo живёт в shared/types/media.ts (доменный тип). Реэкспорт — чтобы существующие
// импорты `from ".../api/tauri"` продолжали работать.
export type { MediaInfo };

// Открыть системный диалог выбора видеофайла. Возвращает путь или null (отмена).
export async function pickInputFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Видео",
        extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v", "flv", "wmv"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

// Получить метаданные файла через ffprobe (Rust-команда probe_media)
export async function probeMedia(path: string): Promise<MediaInfo> {
  return invoke<MediaInfo>("probe_media", { path });
}

// Диалог «куда сохранить результат». Возвращает путь или null (отмена).
export async function pickOutputFile(defaultName: string): Promise<string | null> {
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: "Видео", extensions: ["mp4", "mov", "mkv", "webm", "gif"] }],
  });
  return selected ?? null;
}

// Подписаться на прогресс рендера (0..100). Возвращает функцию отписки.
export function onRenderProgress(cb: (percent: number) => void): Promise<UnlistenFn> {
  return listen<number>("render-progress", (e) => cb(e.payload));
}

// Запустить рендер. args — из генератора команды; duration — длительность входа для процента.
export async function runFfmpeg(args: string[], duration: number | null): Promise<void> {
  return invoke("run_ffmpeg", { args, durationSec: duration });
}

// Извлечь кадр для превью. vf — цепочка фильтров (null/"" → кадр исходника), atSec — момент.
// Rust-команда extract_frame пишет JPG во временную папку и возвращает путь к нему.
// convertFileSrc превращает путь в URL asset-протокола (asset.localhost), пригодный для <img>.
export async function extractFrame(
  inputPath: string,
  vf: string | null,
  atSec: number,
): Promise<string> {
  const path = await invoke<string>("extract_frame", { inputPath, vf, atSec });
  return convertFileSrc(path);
}
