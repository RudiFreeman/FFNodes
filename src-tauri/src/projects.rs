// Команды чтения/записи файла проекта (.ffvproj), пресетов и списка последних проектов.
// 🔒 Безопасность (Спринт 4): принимаем пути/имена от фронта и из содержимого файлов проекта.
//   - Файл проекта: путь приходит из системного диалога save/open (его выбрал пользователь) —
//     пишем/читаем как есть, но содержимое файла НЕ интерпретируем здесь (валидация формы и
//     путей входов — на фронте: deserialize строго проверяет форму, safePath применяется к
//     путям входов перед передачей в ffmpeg/ffprobe).
//   - Пресеты/recent: лежат в app-config-папке приложения; имя пресета приходит от пользователя,
//     поэтому СТРОГО санируем (sanitize_file_stem) — без разделителей и «..», чтобы нельзя было
//     выйти за пределы папки пресетов (path traversal).
// Файлы читаем/пишем как UTF-8 текст; парсинг JSON — на фронте.
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// Папка для пресетов внутри app-config. Создаётся при первой записи.
const PRESETS_DIR: &str = "presets";
// Имя файла со списком последних проектов (в app-config).
const RECENT_FILE: &str = "recent.json";

// Записать текст в файл проекта по абсолютному пути из save-диалога.
// Путь выбрал пользователь системным диалогом — доверяем именно как месту записи.
#[tauri::command]
pub fn write_project_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Не удалось сохранить проект: {e}"))
}

// Прочитать текст файла проекта по абсолютному пути из open-диалога.
#[tauri::command]
pub fn read_project_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Не удалось открыть проект: {e}"))
}

// --- Пресеты (хранятся в app-config/presets/<имя>.json) ---

// Сохранить пресет. name санируется (без разделителей/«..») — защита от path traversal.
#[tauri::command]
pub fn write_preset(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    let dir = presets_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Не удалось создать папку пресетов: {e}"))?;
    let file = dir.join(format!("{}.json", sanitize_file_stem(&name)?));
    fs::write(&file, contents).map_err(|e| format!("Не удалось сохранить пресет: {e}"))
}

// Прочитать пресет по имени (тоже санируется).
#[tauri::command]
pub fn read_preset(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let file = presets_dir(&app)?.join(format!("{}.json", sanitize_file_stem(&name)?));
    fs::read_to_string(&file).map_err(|e| format!("Не удалось открыть пресет: {e}"))
}

// Список имён пресетов (без расширения), отсортированный. Нет папки — пустой список.
#[tauri::command]
pub fn list_presets(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = presets_dir(&app)?;
    let Ok(entries) = fs::read_dir(&dir) else {
        return Ok(Vec::new()); // папки ещё нет — пресетов нет
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.strip_suffix(".json").map(String::from)
        })
        .collect();
    names.sort();
    Ok(names)
}

// Удалить пресет по имени.
#[tauri::command]
pub fn delete_preset(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let file = presets_dir(&app)?.join(format!("{}.json", sanitize_file_stem(&name)?));
    fs::remove_file(&file).map_err(|e| format!("Не удалось удалить пресет: {e}"))
}

// --- Список последних проектов (app-config/recent.json) ---

// Записать JSON списка последних проектов (фронт формирует и обрезает список сам).
#[tauri::command]
pub fn write_recent(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = config_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Не удалось создать папку настроек: {e}"))?;
    fs::write(dir.join(RECENT_FILE), contents)
        .map_err(|e| format!("Не удалось сохранить список проектов: {e}"))
}

// Прочитать JSON списка последних проектов. Файла нет — отдаём пустой массив.
#[tauri::command]
pub fn read_recent(app: tauri::AppHandle) -> Result<String, String> {
    let file = config_dir(&app)?.join(RECENT_FILE);
    match fs::read_to_string(&file) {
        Ok(s) => Ok(s),
        Err(_) => Ok("[]".to_string()), // нет файла/нечитаем — пустой список, не ошибка
    }
}

// --- Внутреннее ---

// Папка app-config приложения (создаёт ОС-зависимый путь, напр. ~/Library/Application Support/<id>).
fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Не удалось определить папку настроек: {e}"))
}

fn presets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(config_dir(app)?.join(PRESETS_DIR))
}

// Санировать имя файла-основы (для пресетов): оставляем только безопасные символы, режем
// разделители путей и «..». Гарантирует, что итог — простое имя файла внутри папки пресетов,
// а не выход за её пределы (path traversal). Пусто/целиком мусор → ошибка.
fn sanitize_file_stem(name: &str) -> Result<String, String> {
    let cleaned: String = name
        .trim()
        .chars()
        // запрещаем разделители путей и управляющие; точку оставляем, но «..» отсекаем ниже
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '\0') && !c.is_control())
        .collect();
    let cleaned = cleaned.trim_matches('.').trim().to_string();
    if cleaned.is_empty() {
        return Err("Недопустимое имя пресета".to_string());
    }
    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_then_read_project_round_trips() {
        // Запись и чтение файла проекта во временной папке восстанавливают тот же текст
        let mut path = std::env::temp_dir();
        path.push(format!(
            "ffv-test-{}.ffvproj",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let p = path.to_string_lossy().to_string();
        let content = r#"{"format":"ffmpeg-visual-project","version":1}"#.to_string();

        write_project_file(p.clone(), content.clone()).unwrap();
        let back = read_project_file(p.clone()).unwrap();
        assert_eq!(back, content);

        let _ = fs::remove_file(&p);
    }

    #[test]
    fn read_missing_project_is_error() {
        let err = read_project_file("/nope/does-not-exist.ffvproj".to_string());
        assert!(err.is_err());
    }

    #[test]
    fn sanitize_file_stem_strips_traversal() {
        // Разделители и «..» вырезаются — нельзя выйти за папку пресетов
        assert_eq!(sanitize_file_stem("../../etc/passwd").unwrap(), "etcpasswd");
        assert_eq!(sanitize_file_stem("my preset").unwrap(), "my preset");
        assert_eq!(sanitize_file_stem("a/b\\c:d").unwrap(), "abcd");
        assert_eq!(sanitize_file_stem("..").err().is_some(), true);
        assert_eq!(sanitize_file_stem("   ").err().is_some(), true);
        assert_eq!(sanitize_file_stem("").err().is_some(), true);
        // обычное имя сохраняется
        assert_eq!(sanitize_file_stem("Telegram 720p").unwrap(), "Telegram 720p");
    }
}
