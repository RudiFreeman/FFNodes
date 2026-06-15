// Команды для работы с FFmpeg/ffprobe. См. docs/ARCHITECTURE.md §6.
// 🔒 Безопасность: бинарник запускаем напрямую (Command), НЕ через shell — нет инъекций
//    даже если в пути файла спецсимволы. Аргументы передаём массивом.
use std::process::Command;

// Метаданные медиафайла (отдаём во фронт). Поля опциональны — не все файлы их имеют.
#[derive(serde::Serialize)]
pub struct MediaInfo {
    pub duration: Option<f64>,    // секунды
    pub width: Option<u32>,       // пиксели
    pub height: Option<u32>,      // пиксели
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub fps: Option<f64>,
    pub size_bytes: Option<u64>,
    pub format: Option<String>,   // контейнер (mp4, mov…)
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
        audio_codec: str_field(audio, "codec_name"),
        fps: video
            .and_then(|v| v.get("r_frame_rate"))
            .and_then(|r| r.as_str())
            .and_then(parse_fraction),
        size_bytes: format
            .and_then(|f| f.get("size"))
            .and_then(|s| s.as_str())
            .and_then(|s| s.parse().ok()),
        format: str_field(format, "format_name"),
    })
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
            "format": {"format_name": "mov,mp4", "duration": "57.984", "size": "53816361"},
            "streams": [
                {"codec_type": "video", "codec_name": "hevc", "width": 1080, "height": 1920, "r_frame_rate": "30/1"},
                {"codec_type": "audio", "codec_name": "aac"}
            ]
        }"#;
        let info = parse_probe_json(sample).unwrap();
        assert_eq!(info.width, Some(1080));
        assert_eq!(info.height, Some(1920));
        assert_eq!(info.video_codec.as_deref(), Some("hevc"));
        assert_eq!(info.audio_codec.as_deref(), Some("aac"));
        assert_eq!(info.fps, Some(30.0));
        assert_eq!(info.duration, Some(57.984));
        assert_eq!(info.size_bytes, Some(53816361));
    }

    #[test]
    fn parse_probe_json_handles_missing_audio() {
        let sample = br#"{"format": {}, "streams": [{"codec_type": "video", "codec_name": "h264"}]}"#;
        let info = parse_probe_json(sample).unwrap();
        assert_eq!(info.video_codec.as_deref(), Some("h264"));
        assert_eq!(info.audio_codec, None); // нет аудиопотока — None, не паника
        assert_eq!(info.width, None);
    }

    #[test]
    fn parse_probe_json_rejects_garbage() {
        assert!(parse_probe_json(b"not json").is_err());
    }
}
