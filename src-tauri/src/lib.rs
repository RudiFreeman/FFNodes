// Точка входа Tauri-приложения: регистрация плагинов и команд.
mod ffmpeg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // При старте чистим превью-кадры от прошлых сессий (N-011): keep=0 — удалить все
        .setup(|_app| {
            ffmpeg::cleanup_old_frames(0);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ffmpeg::probe_media,
            ffmpeg::run_ffmpeg,
            ffmpeg::extract_frame
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
