# Реестр тестов — FFmpeg Visual

Эта папка — **реестр** (карта покрытия), а НЕ хранилище тестов. Сами тесты лежат рядом
с кодом: фронт — `*.test.ts` возле файла в `src/`; Rust — в модуле в `#[cfg(test)]`.
Правило №7 CLAUDE.md: заметил недостающий тест — допиши строку в «🔴 Нужно покрыть».

**Запуск:** `npm test` (Vitest, фронт) и `cargo test` в `src-tauri/` (Rust).

## ✅ Что уже покрыто

| Что | Где | Тестов |
|---|---|---|
| Каталог: индекс, уникальность id, поиск, группировка | `src/shared/lib/ffmpeg/catalog/catalog.test.ts` | 5 |
| `toCommand`: vf-фильтры + outputArgs (compress/аудио) + новые (поворот/скорость/цвет/GIF) | там же (table-driven) | 12 |
| Генератор: цепочки по связям, порядок, разрыв, цикл, пустой граф, outputArgs, комбинация, путь | `src/shared/lib/ffmpeg/generate.test.ts` | 11 |
| Обход цепочки `orderedFilters`: порядок по связям, пустая цепочка, нет output, разрыв, цикл | `src/shared/lib/ffmpeg/chain.test.ts` | 5 |
| Предсказание `predictOutput`: scale/fps/trim/speed/rotate/gif/аудио, цепочка, без applyToInfo, иммутабельность | `src/shared/lib/ffmpeg/predict.test.ts` | 14 |

**Фронт (Vitest): 47 ✅**

### Rust (`cargo test` в `src-tauri/`)

| Что | Где | Тестов |
|---|---|---|
| Разбор ответа ffprobe: дроби FPS, полный набор полей (битрейт/профиль/aspect/pix_fmt/цвет/кадры/аудио-детали/энкодер/дата), fallback битрейта на контейнер, нет аудио, мусор | `src-tauri/src/ffmpeg.rs` (`#[cfg(test)]`) | 5 |
| Парс прогресса рендера (`out_time_us` → секунды) | там же | 1 |

**Rust: 6 ✅**

## 🔴 Нужно покрыть (по мере появления кода)

- Валидатор `validate.ts` (циклы, висячие ноды, незаполненные параметры) — когда появится.
- Хук `useGraph` (вставка в цепочку, перецепка связей, onParamChange) — компонентные тесты
  (нужен @testing-library). Логика вставки сейчас проверена только вживую (Playwright).
- Tauri-команды (`run_ffmpeg`, `probe_media`) — отдельно/вручную (тонкий слой).
