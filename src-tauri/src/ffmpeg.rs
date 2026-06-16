// Команды для работы с FFmpeg/ffprobe. См. docs/ARCHITECTURE.md §6.
// 🔒 Безопасность: бинарник запускаем напрямую (Command), НЕ через shell — нет инъекций
//    даже если в пути файла спецсимволы. Аргументы передаём массивом.
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;

// Метаданные медиафайла (отдаём во фронт). Поля опциональны — не все файлы их имеют.
// Отбираем только осмысленные поля ffprobe (служебные codec_tag/disposition/time_base — мусор, не берём).
#[derive(serde::Serialize)]
pub struct MediaInfo {
    pub duration: Option<f64>,    // секунды
    pub width: Option<u32>,       // пиксели
    pub height: Option<u32>,      // пиксели
    // Видео
    pub video_codec: Option<String>,
    pub video_codec_long: Option<String>, // полное имя («H.265 / HEVC…»)
    pub video_profile: Option<String>,     // профиль кодека (High, Main 10…)
    pub video_bitrate: Option<u64>,        // бит/с (видеопоток или контейнер)
    pub aspect_ratio: Option<String>,      // соотношение сторон («9:16»)
    pub pix_fmt: Option<String>,           // формат пикселей («yuv420p10le»)
    pub color_space: Option<String>,       // цветовое пространство («bt709»)
    pub frame_count: Option<u64>,          // число кадров (nb_frames)
    // Звук
    pub audio_codec: Option<String>,
    pub audio_codec_long: Option<String>,  // полное имя кодека аудио
    pub audio_bitrate: Option<u64>,        // бит/с
    pub audio_sample_rate: Option<u32>,    // Гц (44100, 48000…)
    pub audio_channels: Option<u32>,       // число каналов (2 = стерео)
    pub channel_layout: Option<String>,    // раскладка («stereo», «5.1»)
    pub sample_fmt: Option<String>,        // формат сэмплов («fltp»)
    // Общее
    pub fps: Option<f64>,
    pub size_bytes: Option<u64>,
    pub format: Option<String>,        // контейнер (mov,mp4…)
    pub format_long: Option<String>,   // полное имя контейнера («QuickTime / MOV»)
    pub stream_count: Option<u32>,     // число потоков
    pub creation_time: Option<String>, // дата создания (из tags)
    pub encoder: Option<String>,        // энкодер (из tags, напр. «DaVinci Resolve»)
}

// Распарсить дробь FFmpeg вида "30/1" или "30000/1001" в число
fn parse_fraction(s: &str) -> Option<f64> {
    let (num, den) = s.split_once('/')?;
    let num: f64 = num.parse().ok()?;
    let den: f64 = den.parse().ok()?;
    if den == 0.0 {
        None
    } else {
        Some(num / den)
    }
}

// Получить метаданные файла через ffprobe (только чтение, файл не меняем).
// 🔒 ffprobe вызывается напрямую (Command), путь — отдельным аргументом, не через shell.
#[tauri::command]
pub fn probe_media(path: String) -> Result<MediaInfo, String> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output()
        .map_err(|e| format!("Не удалось запустить ffprobe: {e}. Установлен ли FFmpeg?"))?;

    if !output.status.success() {
        return Err("ffprobe не смог прочитать файл".to_string());
    }

    parse_probe_json(&output.stdout)
}

// Разбор JSON-ответа ffprobe в MediaInfo. Отделено от запуска процесса — тестируемо.
fn parse_probe_json(bytes: &[u8]) -> Result<MediaInfo, String> {
    let json: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|e| format!("Не удалось разобрать ответ ffprobe: {e}"))?;

    let format = json.get("format");
    let streams = json.get("streams").and_then(|s| s.as_array());

    // Первый видеопоток и первый аудиопоток
    let video = streams.and_then(|arr| {
        arr.iter()
            .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"))
    });
    let audio = streams.and_then(|arr| {
        arr.iter()
            .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio"))
    });

    let str_field = |v: Option<&serde_json::Value>, key: &str| {
        v.and_then(|x| x.get(key))
            .and_then(|x| x.as_str())
            .map(String::from)
    };
    // Целое поле, которое ffprobe часто отдаёт строкой ("128000") или числом
    let u64_field = |v: Option<&serde_json::Value>, key: &str| -> Option<u64> {
        let x = v?.get(key)?;
        x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok()))
    };
    // Достать тег из tags-объекта потока/формата (creation_time, encoder…)
    let tag = |v: Option<&serde_json::Value>, key: &str| -> Option<String> {
        v.and_then(|x| x.get("tags"))
            .and_then(|t| t.get(key))
            .and_then(|t| t.as_str())
            .map(String::from)
    };
    // creation_time / encoder ищем сначала в видеопотоке, потом в format
    let from_video_or_format = |key: &str| tag(video, key).or_else(|| tag(format, key));

    Ok(MediaInfo {
        duration: format
            .and_then(|f| f.get("duration"))
            .and_then(|d| d.as_str())
            .and_then(|d| d.parse().ok()),
        width: video
            .and_then(|v| v.get("width"))
            .and_then(|w| w.as_u64())
            .map(|w| w as u32),
        height: video
            .and_then(|v| v.get("height"))
            .and_then(|h| h.as_u64())
            .map(|h| h as u32),
        video_codec: str_field(video, "codec_name"),
        video_codec_long: str_field(video, "codec_long_name"),
        video_profile: str_field(video, "profile"),
        // Битрейт видеопотока; если его нет — битрейт контейнера (format)
        video_bitrate: u64_field(video, "bit_rate").or_else(|| u64_field(format, "bit_rate")),
        aspect_ratio: str_field(video, "display_aspect_ratio"),
        pix_fmt: str_field(video, "pix_fmt"),
        color_space: str_field(video, "color_space"),
        frame_count: u64_field(video, "nb_frames"),
        audio_codec: str_field(audio, "codec_name"),
        audio_codec_long: str_field(audio, "codec_long_name"),
        audio_bitrate: u64_field(audio, "bit_rate"),
        audio_sample_rate: u64_field(audio, "sample_rate").map(|r| r as u32),
        audio_channels: audio
            .and_then(|a| a.get("channels"))
            .and_then(|c| c.as_u64())
            .map(|c| c as u32),
        channel_layout: str_field(audio, "channel_layout"),
        sample_fmt: str_field(audio, "sample_fmt"),
        fps: video
            .and_then(|v| v.get("r_frame_rate"))
            .and_then(|r| r.as_str())
            .and_then(parse_fraction),
        size_bytes: format
            .and_then(|f| f.get("size"))
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse().ok()),
        format: str_field(format, "format_name"),
        format_long: str_field(format, "format_long_name"),
        stream_count: u64_field(format, "nb_streams").map(|n| n as u32),
        creation_time: from_video_or_format("creation_time"),
        encoder: from_video_or_format("encoder"),
    })
}

// Собрать аргументы ffmpeg для извлечения одного кадра. Отделено от запуска процесса —
// тестируемо. -ss до -i = быстрый seek по ключевым кадрам; -frames:v 1 = один кадр;
// -q:v 3 = хорошее JPEG-качество; vf (если задан) — наша цепочка фильтров из графа.
// out_path — куда писать кадр (JPG во временной папке).
fn build_frame_args(input_path: &str, vf: Option<&str>, at_sec: f64, out_path: &str) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-ss".into(),
        format!("{at_sec}"),
        "-i".into(),
        input_path.into(),
        "-frames:v".into(),
        "1".into(),
        "-q:v".into(),
        "3".into(),
    ];
    if let Some(filters) = vf {
        if !filters.is_empty() {
            args.push("-vf".into());
            args.push(filters.into());
        }
    }
    args.push(out_path.into());
    args
}

// Извлечь один кадр из видео в JPG (для превью «До»/«После»). Возвращает путь к кадру.
// vf — цепочка фильтров из нашего генератора (для «После»); None/пусто — кадр исходника.
// 🔒 Безопасность: ffmpeg вызывается напрямую (Command), путь и vf — отдельными аргументами
//    массива, не через shell. vf приходит из генератора команды (generate.ts), не из сырого
//    пользовательского ввода. Кадр пишем в temp-папку ОС (кроссплатформенно).
#[tauri::command]
pub fn extract_frame(input_path: String, vf: Option<String>, at_sec: f64) -> Result<String, String> {
    // Уникальное имя по наносекундам — чтобы «До» и «После» не перетирали друг друга и
    // браузер не кэшировал старый кадр под тем же путём.
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut out = std::env::temp_dir();
    out.push(format!("ffmpeg-visual-frame-{stamp}.jpg"));
    let out_path = out.to_string_lossy().to_string();

    let args = build_frame_args(&input_path, vf.as_deref(), at_sec, &out_path);

    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|e| format!("Не удалось запустить ffmpeg: {e}. Установлен ли FFmpeg?"))?;

    if !output.status.success() {
        return Err("ffmpeg не смог извлечь кадр".to_string());
    }

    // Подчистить накопленные кадры, оставив окно последних N (До + После + запас на
    // дебаунс-гонки «После»). N-011: имена уникальны (наносекунды) и не перетираются,
    // поэтому без чистки растут бесконечно.
    cleanup_old_frames(FRAME_KEEP);

    Ok(out_path)
}

// Сколько последних кадров оставляем в temp в рамках сессии (До + После + запас).
const FRAME_KEEP: usize = 4;
// Префикс/суффикс имён наших превью-кадров (по ним опознаём свои файлы в temp).
const FRAME_PREFIX: &str = "ffmpeg-visual-frame-";
const FRAME_SUFFIX: &str = ".jpg";

// Из списка путей кадров выбрать те, что нужно удалить: всё, кроме `keep` последних.
// Имена кадров содержат наносекундный штамп, поэтому лексикографическая сортировка =
// хронологическая. Чистая функция (без файловой системы) — тестируемо.
fn frames_to_cleanup(existing: &[String], keep: usize) -> Vec<String> {
    if existing.len() <= keep {
        return Vec::new();
    }
    let mut sorted = existing.to_vec();
    sorted.sort();
    let cut = sorted.len() - keep;
    sorted.into_iter().take(cut).collect()
}

// Просканировать temp-папку по маске наших кадров и удалить старые, оставив `keep`
// последних. Ошибки чтения/удаления игнорируем — чистка не должна ронять превью.
// pub — вызывается при старте приложения (lib.rs setup) с keep=0 для очистки от
// прошлых сессий.
pub fn cleanup_old_frames(keep: usize) {
    let dir = std::env::temp_dir();
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return;
    };
    let frames: Vec<String> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with(FRAME_PREFIX) && name.ends_with(FRAME_SUFFIX) {
                Some(e.path().to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();
    // Сортировку и выбор «что удалить» делает frames_to_cleanup (read_dir порядок не гарантирует)
    for path in frames_to_cleanup(&frames, keep) {
        let _ = std::fs::remove_file(path);
    }
}

// Из строки прогресса FFmpeg (`-progress`) достать обработанное время в секундах.
// FFmpeg пишет строки вида `out_time_us=12345678` (микросекунды). Возвращаем секунды.
fn parse_progress_seconds(line: &str) -> Option<f64> {
    let value = line.strip_prefix("out_time_us=")?;
    let us: f64 = value.trim().parse().ok()?;
    Some(us / 1_000_000.0)
}

// Запустить FFmpeg с переданными аргументами и стримить прогресс во фронт.
// duration_sec — длительность входа (из probe_media) для расчёта процента; может быть None.
// 🔒 ffmpeg вызывается напрямую, аргументы — массивом (без shell). Прогресс идёт событиями
//    "render-progress" (0..100), завершение — "render-done" / ошибка как Err.
// ВАЖНО: команда async — иначе Tauri выполняет её на главном потоке и НЕ доставляет события
//    в webview до возврата (прогресс приходил бы пачкой в конце вместо роста по ходу).
#[tauri::command]
pub async fn run_ffmpeg(
    app: tauri::AppHandle,
    args: Vec<String>,
    duration_sec: Option<f64>,
) -> Result<(), String> {
    // Добавляем машинный прогресс в stdout и подавляем обычную статистику
    let mut full_args: Vec<String> = vec!["-y".into(), "-progress".into(), "pipe:1".into(), "-nostats".into()];
    full_args.extend(args);

    let mut child = Command::new("ffmpeg")
        .args(&full_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Не удалось запустить ffmpeg: {e}. Установлен ли FFmpeg?"))?;

    // Читаем прогресс построчно из stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if let Some(done_sec) = parse_progress_seconds(&line) {
                let percent = match duration_sec {
                    Some(total) if total > 0.0 => ((done_sec / total) * 100.0).clamp(0.0, 100.0),
                    _ => 0.0,
                };
                let _ = app.emit("render-progress", percent);
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Ошибка ожидания ffmpeg: {e}"))?;

    if status.success() {
        let _ = app.emit("render-progress", 100.0_f64);
        let _ = app.emit("render-done", ());
        Ok(())
    } else {
        Err("ffmpeg завершился с ошибкой при рендере".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_fraction_works() {
        assert_eq!(parse_fraction("30/1"), Some(30.0));
        assert_eq!(parse_fraction("30000/1001"), Some(30000.0 / 1001.0));
        assert_eq!(parse_fraction("25/0"), None); // деление на ноль
        assert_eq!(parse_fraction("abc"), None);
    }

    #[test]
    fn parse_probe_json_extracts_fields() {
        let sample = br#"{
            "format": {"format_name": "mov,mp4", "format_long_name": "QuickTime / MOV", "nb_streams": 3, "duration": "57.984", "size": "53816361", "bit_rate": "7400000",
                "tags": {"creation_time": "2026-06-14T20:50:24.000000Z", "encoder": "DaVinci Resolve"}},
            "streams": [
                {"codec_type": "video", "codec_name": "hevc", "codec_long_name": "H.265 / HEVC", "profile": "Main 10", "bit_rate": "7000000",
                    "width": 1080, "height": 1920, "display_aspect_ratio": "9:16", "pix_fmt": "yuv420p10le", "color_space": "bt709", "nb_frames": "1737", "r_frame_rate": "30/1"},
                {"codec_type": "audio", "codec_name": "aac", "codec_long_name": "AAC (Advanced Audio Coding)", "bit_rate": "320000",
                    "sample_rate": "48000", "channels": 2, "channel_layout": "stereo", "sample_fmt": "fltp"}
            ]
        }"#;
        let info = parse_probe_json(sample).unwrap();
        assert_eq!(info.width, Some(1080));
        assert_eq!(info.height, Some(1920));
        assert_eq!(info.video_codec.as_deref(), Some("hevc"));
        assert_eq!(info.video_codec_long.as_deref(), Some("H.265 / HEVC"));
        assert_eq!(info.video_profile.as_deref(), Some("Main 10"));
        assert_eq!(info.video_bitrate, Some(7_000_000));
        assert_eq!(info.aspect_ratio.as_deref(), Some("9:16"));
        assert_eq!(info.pix_fmt.as_deref(), Some("yuv420p10le"));
        assert_eq!(info.color_space.as_deref(), Some("bt709"));
        assert_eq!(info.frame_count, Some(1737));
        assert_eq!(info.audio_codec.as_deref(), Some("aac"));
        assert_eq!(info.audio_bitrate, Some(320000));
        assert_eq!(info.audio_sample_rate, Some(48000));
        assert_eq!(info.audio_channels, Some(2));
        assert_eq!(info.channel_layout.as_deref(), Some("stereo"));
        assert_eq!(info.sample_fmt.as_deref(), Some("fltp"));
        assert_eq!(info.fps, Some(30.0));
        assert_eq!(info.duration, Some(57.984));
        assert_eq!(info.size_bytes, Some(53816361));
        assert_eq!(info.format_long.as_deref(), Some("QuickTime / MOV"));
        assert_eq!(info.stream_count, Some(3));
        assert_eq!(info.encoder.as_deref(), Some("DaVinci Resolve"));
        assert!(info.creation_time.is_some());
    }

    #[test]
    fn parse_probe_json_video_bitrate_falls_back_to_format() {
        // У видеопотока нет bit_rate — берём из контейнера (format)
        let sample = br#"{
            "format": {"bit_rate": "5000000"},
            "streams": [{"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080}]
        }"#;
        let info = parse_probe_json(sample).unwrap();
        assert_eq!(info.video_bitrate, Some(5_000_000));
    }

    #[test]
    fn parse_probe_json_handles_missing_audio() {
        let sample = br#"{"format": {}, "streams": [{"codec_type": "video", "codec_name": "h264"}]}"#;
        let info = parse_probe_json(sample).unwrap();
        assert_eq!(info.video_codec.as_deref(), Some("h264"));
        assert_eq!(info.audio_codec, None); // нет аудиопотока — None, не паника
        assert_eq!(info.audio_sample_rate, None);
        assert_eq!(info.audio_channels, None);
        assert_eq!(info.width, None);
    }

    #[test]
    fn parse_probe_json_rejects_garbage() {
        assert!(parse_probe_json(b"not json").is_err());
    }

    #[test]
    fn build_frame_args_with_filters() {
        let args = build_frame_args("/tmp/in.mov", Some("scale=640:-1"), 1.5, "/tmp/out.jpg");
        assert_eq!(
            args,
            vec![
                "-y", "-ss", "1.5", "-i", "/tmp/in.mov",
                "-frames:v", "1", "-q:v", "3",
                "-vf", "scale=640:-1", "/tmp/out.jpg",
            ]
        );
    }

    #[test]
    fn build_frame_args_without_filters() {
        // Без vf (кадр исходника) — флаг -vf не добавляем
        let args = build_frame_args("/tmp/in.mov", None, 0.0, "/tmp/out.jpg");
        assert!(!args.iter().any(|a| a == "-vf"));
        assert_eq!(args.last().unwrap(), "/tmp/out.jpg");
    }

    #[test]
    fn build_frame_args_empty_filters_omitted() {
        // Пустая строка vf не должна добавлять флаг -vf
        let args = build_frame_args("/tmp/in.mov", Some(""), 0.0, "/tmp/out.jpg");
        assert!(!args.iter().any(|a| a == "-vf"));
    }

    #[test]
    fn frames_to_cleanup_keeps_last_n() {
        // 5 кадров (имена по штампу, не по порядку в массиве), keep=2 → удалить 3 старейших
        let frames = vec![
            "/tmp/ffmpeg-visual-frame-300.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-100.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-500.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-200.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-400.jpg".to_string(),
        ];
        let mut to_del = frames_to_cleanup(&frames, 2);
        to_del.sort();
        assert_eq!(
            to_del,
            vec![
                "/tmp/ffmpeg-visual-frame-100.jpg".to_string(),
                "/tmp/ffmpeg-visual-frame-200.jpg".to_string(),
                "/tmp/ffmpeg-visual-frame-300.jpg".to_string(),
            ]
        );
    }

    #[test]
    fn frames_to_cleanup_nothing_when_within_keep() {
        // Кадров не больше keep — удалять нечего
        let frames = vec![
            "/tmp/ffmpeg-visual-frame-1.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-2.jpg".to_string(),
        ];
        assert!(frames_to_cleanup(&frames, 4).is_empty());
        assert!(frames_to_cleanup(&frames, 2).is_empty());
    }

    #[test]
    fn frames_to_cleanup_keep_zero_removes_all() {
        // keep=0 (старт приложения) — удаляем все найденные кадры
        let frames = vec![
            "/tmp/ffmpeg-visual-frame-1.jpg".to_string(),
            "/tmp/ffmpeg-visual-frame-2.jpg".to_string(),
        ];
        let mut to_del = frames_to_cleanup(&frames, 0);
        to_del.sort();
        assert_eq!(to_del, frames);
    }

    #[test]
    fn frames_to_cleanup_empty_input() {
        let frames: Vec<String> = Vec::new();
        assert!(frames_to_cleanup(&frames, 0).is_empty());
        assert!(frames_to_cleanup(&frames, 4).is_empty());
    }

    #[test]
    fn parse_progress_seconds_works() {
        assert_eq!(parse_progress_seconds("out_time_us=12345678"), Some(12.345678));
        assert_eq!(parse_progress_seconds("out_time_us=0"), Some(0.0));
        assert_eq!(parse_progress_seconds("frame=42"), None); // другая строка прогресса
        assert_eq!(parse_progress_seconds("out_time_us=abc"), None);
    }
}
