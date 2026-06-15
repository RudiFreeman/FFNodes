// Обёртки над Tauri invoke() и плагинами. См. docs/ARCHITECTURE.md §6, §8.
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

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
