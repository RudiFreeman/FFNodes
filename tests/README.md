# Реестр тестов — FFmpeg Visual

Эта папка — **реестр** (карта покрытия), а НЕ хранилище тестов. Сами тесты лежат рядом
с кодом: фронт — `*.test.ts` возле файла в `src/`; Rust — в модуле в `#[cfg(test)]`.
Правило №7 CLAUDE.md: заметил недостающий тест — допиши строку в «🔴 Нужно покрыть».

**Запуск:** `npm test` (Vitest, фронт) и `cargo test` в `src-tauri/` (Rust).

## ✅ Что уже покрыто

| Что | Где | Тестов |
|---|---|---|
| Каталог: индекс, уникальность id, поиск, группировка | `src/shared/lib/ffmpeg/catalog/catalog.test.ts` | 5 |
| `toCommand`: vf-фильтры + outputArgs (compress/аудио) + поворот/скорость/цвет/GIF + звук/эффекты/кодек (volume `af`, fade in/out, reverse, codec H.265/VP9) + резкость/размытие/виньетка/нормализация звука (unsharp, gblur, vignette, loudnorm `af`) + отступы/поворот-угол/затухание-звука/моно (pad +applyToInfo, rotate=°*PI/180, afade in/out, -ac 1 +applyToInfo) | там же (table-driven) | 29 |
| `atempoChain` (N-009): множители в пределах 0.5…2.0, =1 (пусто), >2 (×4→2,2; ×3→2,1.5), <0.5 (×0.25→0.5,0.5), некорректный, speed→af | там же | 7 |
| Генератор: цепочки по связям, порядок, разрыв, цикл, пустой граф, outputArgs, комбинация, путь, -af + -vf вместе; filter_complex путь (GIF-палитра, путь из params.path); мульти-аутпут (Спринт 3, Вариант A): 1 вход→2 выхода (split + две секции -map/outputArgs/файл, outputPlaceholders), display обеих секций, висящий выход→ошибка | `src/shared/lib/ffmpeg/generate.test.ts` | 19 |
| Обход цепочки `orderedFilters`: порядок по связям, пустая цепочка, нет output, разрыв, цикл | `src/shared/lib/ffmpeg/chain.test.ts` | 5 |
| DAG `topoSort`/`isLinearGraph`/`outputNodes` (multi-input + мульти-аутпут): линия=orderedFilters, ветвление, два входа в merge, цикл/обрыв/нет input/output→null, недостижимый вход→null; мульти-аутпут (1 вход→2 выхода через split, висящий выход→null, 2 выхода→не линеен); `outputNodes` (один/несколько, порядок); рубильник линейности (один/два входа/выхода, ветвление, слияние, нода с merge), incoming/outgoing | `src/shared/lib/ffmpeg/dag.test.ts` | 21 |
| Построитель filter_complex `buildComplexPlan` + `buildMultiOutputPlan` (`complex/build.test.ts`): обычные фильтры в лейблах, свежий лейбл на шаг, фильтр без vf насквозь, два входа, overlay/concat end-to-end, scale перед overlay, ошибки (нет файла, обрыв, неизвестный фильтр); мульти-аутпут — split/asplit на 2-3 выхода, разные кодеки по выходам (outputArgs ветки), общий фильтр до развилки (scale один раз→split), вход без файла→ошибка | `src/shared/lib/ffmpeg/complex/build.test.ts` | 17 |
| merge-операции `overlay`/`concat` (`catalog/merge.test.ts`): videoInputs/audioInputs, toComplex-фрагмент, applyMerge (overlay=размер основного, concat=сумма длительностей) | `src/shared/lib/ffmpeg/catalog/merge.test.ts` | 7 |
| Предсказание `predictOutput`: scale/fps/trim/speed/rotate/gif/аудио, цепочка, без applyToInfo, иммутабельность; слияние (overlay=размер основного, concat=сумма длительностей, GIF через applyToInfo); размер (N-010: scale↓, trim↓, flip=реальный, extract_audio, compress CRF реалистичный) | `src/shared/lib/ffmpeg/predict.test.ts` | 22 |
| Оценка размера `size.ts` (N-010): estimateSize (битрейт×длительность, без данных→прежний, только видео/аудио), scaleVideoBitrate (∝ пикселям/fps, без битрейта→null, без размеров→без изменений), estimateBitrateFromCrf (CRF23≈5Мбит/с, ±6 CRF=×2/÷2, без размеров→null) | `src/shared/lib/ffmpeg/size.test.ts` | 12 |
| Vf-цепочка для кадра `videoFilterChain`: порядок фрагментов, только-кодек→пусто, без фильтров→пусто, разрыв→null, неизвестный фильтр→null; план кадра `previewPlan` (линейный→vf, GIF/overlay→complex, обрыв→null); момент кадра `previewMoment` (N-012: без trim→duration/2, trim→середина диапазона, сдвиг, clamp к длительности, невалидный trim→fallback, null→0, speed не влияет на момент, trim+speed→по trim) | `src/shared/lib/ffmpeg/frame.test.ts` | 17 |
| Перецепка при удалении `bridgesOnDelete`+`applyBridges`: средняя нода, длинная цепочка, два подряд, два несмежных, нет входящей/исходящей, мост по полному снимку, самопетля, без дублей, иммутабельность; merge-ноды (мостим только основной вход по min targetHandle, накладка/второй ролик отцепляется) | `src/features/add-node/relink.test.ts` | 14 |
| Пресеты «Изменить размер» `scale`: toCommand (короткая сторона/половина/свои/дефолт), applyToInfo на гориз/вертик (не раздувает), свои с авто-высотой, без размеров входа; дефолты из входа (Спринт 2): `pad` (размеры входа, null→пусто), `fps` (частота входа округл., null/0→пусто) | `src/shared/lib/ffmpeg/catalog/resize.test.ts` | 16 |
| Дефолты из входа (Спринт 2) `changeCodec.defaultsFromInfo`: h264/hevc/vp9 → label опции, кодек вне списка (av1)/null → пусто | `src/shared/lib/ffmpeg/catalog/convert.test.ts` | 5 |
| Дефолты из входа (Спринт 2) `trim`/`crop`: `trim` (end = длительность округл., null→пусто), `crop` (w/h = кадр входа, null→пусто) | `src/shared/lib/ffmpeg/catalog/trim.test.ts` | 4 |
| Валидация `validateGraph` (N-007): -vn+видеофильтр, -vn+compress, -vn+-an (пустой файл), -an+громкость (needsAudio), громкость+видеофильтр (ок), валидная цепочка, только -an, только -vn, разрыв→молчит, пустая цепочка; дубль выходного флага (N-014): compress+codec оба -c:v, одна -c:v ок, разные флаги (-c:v+-f) не дубль; merge без второго входа (overlay 1 вход→ошибка, 2 входа→ок, GIF single-input→ок) | `src/shared/lib/ffmpeg/validate.test.ts` | 16 |
| Защита пути `safePath` (N-004): ведущий `-` → префикс ./; абсолютные/обычные/пустой не трогаем | `src/shared/lib/ffmpeg/safePath.test.ts` | 2 |
| Отсев не-видео при drag&drop `isSupportedVideo`: все поддерживаемые расширения, регистронезависимость, не-видео/без расширения, точки в пути | `src/shared/lib/videoExtensions.test.ts` | 4 |

**Фронт (Vitest): 206 ✅**

### Rust (`cargo test` в `src-tauri/`)

| Что | Где | Тестов |
|---|---|---|
| Разбор ответа ffprobe: дроби FPS, полный набор полей (битрейт/профиль/aspect/pix_fmt/цвет/кадры/аудио-детали/энкодер/дата), fallback битрейта на контейнер, нет аудио, мусор | `src-tauri/src/ffmpeg.rs` (`#[cfg(test)]`) | 5 |
| Парс прогресса рендера (`out_time_us` → секунды) | там же | 1 |
| Сборка аргументов кадра `build_frame_args`: с фильтрами, без vf, пустой vf не даёт флаг | там же | 3 |
| Сборка аргументов кадра DAG `build_frame_args_complex`: два входа (-ss к первому, два -i, filter_complex, map в скобках), map входа (N:v) без скобок, пустой filter_complex без флага | там же | 2 |
| Чистка кадров `frames_to_cleanup`: окно последних N, в пределах keep→пусто, keep=0→все, пустой вход | там же | 4 |
| Защита пути `safe_path` (N-004): ведущий `-` → префикс ./; абсолютные/обычные/пустой не трогаем | там же | 1 |

**Rust: 16 ✅**

## 🔴 Нужно покрыть (по мере появления кода)

- Валидатор `validate.ts` — несочетаемые операции покрыты (см. выше). Осталось на будущее:
  циклы, висячие ноды, незаполненные обязательные параметры — когда появятся правила.
- Хук `useGraph` (вставка в цепочку, onParamChange) — компонентные тесты
  (нужен @testing-library). Логика вставки сейчас проверена только вживую (Playwright).
  Перецепка при удалении вынесена в чистую `relink.ts` и покрыта (см. выше).
- Tauri-команды (`run_ffmpeg`, `probe_media`, `extract_frame`, `cancel_render`) — отдельно/вручную
  (тонкий слой; отмена требует живого процесса — проверяется вживую).
- Хук `useRender` (статус `cancelled`, `cancel()` помечает отмену и зовёт `cancelRender`,
  различение отмены и сбоя ffmpeg в catch) — компонентные тесты (нужен @testing-library + мок API).
- Хук `usePreviewFrame` (дебаунс «После», токены актуальности против гонок, «После»=«До»
  без фильтров) — компонентные тесты (нужен @testing-library + фейк extractFrame).
- Хук `useFileDrop` (Tauri drag&drop: enter/over→dragging, drop→onDrop(paths[0]), отписка) и
  `acceptDroppedPath` (safePath применён, не-видео не затирает выбранный файл) — компонентные/
  хук-тесты (нужен @testing-library + мок Tauri webview). Пока проверены вживую.
