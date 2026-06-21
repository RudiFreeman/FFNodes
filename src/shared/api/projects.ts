// Обёртки над Tauri-командами проектов/пресетов/последних проектов + файловые диалоги.
// Чистая логика сериализации — в shared/lib/project; здесь только мост к Rust/диалогам.
// 🔒 Пути из диалогов прогоняем через safePath (N-004) — путь с ведущим «-» не должен
//    трактоваться как флаг ffmpeg при последующем использовании.
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { safePath } from "../lib/ffmpeg/safePath";

const PROJECT_EXT = "ffvproj";

// Диалог «куда сохранить проект». defaultName — имя по умолчанию. null — отмена.
export async function pickProjectSaveFile(defaultName: string): Promise<string | null> {
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: "Проект FFmpeg Visual", extensions: [PROJECT_EXT] }],
  });
  return selected ? safePath(selected) : null;
}

// Диалог «открыть проект». null — отмена.
export async function pickProjectOpenFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Проект FFmpeg Visual", extensions: [PROJECT_EXT] }],
  });
  return typeof selected === "string" ? safePath(selected) : null;
}

// Записать/прочитать файл проекта (Rust). Путь — из диалога (абсолютный).
export function writeProjectFile(path: string, contents: string): Promise<void> {
  return invoke("write_project_file", { path, contents });
}
export function readProjectFile(path: string): Promise<string> {
  return invoke<string>("read_project_file", { path });
}

// Существует ли файл (мягкая проверка входов при открытии проекта).
export function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

// --- Пресеты (в app-config/presets) ---
export function writePreset(name: string, contents: string): Promise<void> {
  return invoke("write_preset", { name, contents });
}
export function readPreset(name: string): Promise<string> {
  return invoke<string>("read_preset", { name });
}
export function listPresets(): Promise<string[]> {
  return invoke<string[]>("list_presets");
}
export function deletePreset(name: string): Promise<void> {
  return invoke("delete_preset", { name });
}

// --- Список последних проектов (app-config/recent.json) ---
export function writeRecent(contents: string): Promise<void> {
  return invoke("write_recent", { contents });
}
export function readRecent(): Promise<string> {
  return invoke<string>("read_recent");
}
