// Точка входа Tauri-приложения: регистрация плагинов и команд.
mod ffmpeg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // Общее состояние текущего рендера — чтобы cancel_render мог убить процесс
        .manage(ffmpeg::RenderState::default())
        // При старте чистим превью-кадры от прошлых сессий (N-011): keep=0 — удалить все
        .setup(|_app| {
            ffmpeg::cleanup_old_frames(0);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ffmpeg::probe_media,
            ffmpeg::run_ffmpeg,
            ffmpeg::extract_frame,
            ffmpeg::cancel_render
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
