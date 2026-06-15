// Обёртки над Tauri invoke() и плагинами. См. docs/ARCHITECTURE.md §6, §8.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";

// Метаданные медиафайла (зеркало Rust-структуры MediaInfo)
export interface MediaInfo {
  duration: number | null;
  width: number | null;
  height: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  fps: number | null;
  size_bytes: number | null;
  format: string | null;
}

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
