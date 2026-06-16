// Обезопасить путь от трактовки как флаг ffmpeg/ffprobe (N-004). Путь, начинающийся
// с «-», эти утилиты приняли бы за опцию (argument injection). Префиксуем «./» —
// получается относительный путь («-foo.mp4» → «./-foo.mp4»), читается как файл.
// Зеркалит Rust-функцию `safe_path` (src-tauri/src/ffmpeg.rs) для путей, которые во фронте
// подставляются в args рендера (run_ffmpeg) — Rust там получает готовый массив и не знает,
// какие элементы пути. Абсолютные и обычные пути не трогаем.
export function safePath(path: string): string {
  return path.startsWith("-") ? `./${path}` : path;
}
