# shared/lib/project — подсистема сохранения/загрузки проекта и пресетов

Чистая (без UI и без Tauri) логика сериализации состояния холста в файл проекта `.ffvproj`
и обратно, плюс пресеты выходной ветки. Файловый ввод/вывод и диалоги живут отдельно
(`src/shared/api/projects.ts` + Rust-команды), здесь — только трансформации данных.

## Файлы

- `project.ts` — формат файла проекта: типы `ProjectFile`/`ProjectNode`/`ProjectEdge`,
  константы `PROJECT_FORMAT`, `PROJECT_VERSION`. Версионирование схемы (поле `version`).
- `serialize.ts` — `serializeProject(name, inputPath, nodes, edges)`: React Flow nodes/edges
  → `ProjectFile`. Выдёргивает ТОЛЬКО сохраняемые поля; рантайм (колбэки, info, invalid) отбрасывает.
- `deserialize.ts` — `deserializeProject(raw)`: распарсенный JSON → `{nodes, edges, inputPath,
  warnings}`. Строго валидирует форму и версию (не доверяет содержимому), бросает
  `ProjectFormatError` на чужой/битый/будущий файл. Ноды восстанавливаются без рантайм-полей —
  колбэки доклеивает `useGraph.loadGraph`.
- `preset.ts` — пресеты: настройки ОДНОЙ выходной ветки (операции + params, без файлов/путей).
  `extractBranch(graph, outputNodeId)` собирает линейную ветку выхода (вверх по входящим рёбрам,
  merge/слияние → null), `buildPreset`/`parsePreset` — сборка и строгий разбор файла пресета.
  Применение ветки на холст — `useGraph.applyPreset`; хранилище/диалоги — `usePresets` + Rust.

## Принципы

- Пути входов сохраняются **абсолютными**. Существование файла проверяется мягко уже в
  `useGraph`/`useInputFile` при загрузке (пропал → пометка «не найден», не краш).
- Содержимому `.ffvproj` НЕ доверяем: вся валидация — в `deserialize`.

## Тесты

`serialize.test.ts` (round-trip граф→JSON→граф, мульти-аутпут+merge), `deserialize.test.ts`
(версионирование, устойчивость к мусору), `preset.test.ts` (extractBranch по веткам,
round-trip пресета, валидация). Реестр — `tests/README.md`.
