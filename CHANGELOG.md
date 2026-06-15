# Changelog — FFmpeg Visual

История завершённых этапов. Формат: обратная хронология (новое сверху).

## [Не выпущено]

### Каталог фильтров + добавление нод (этап «catalog-nodes»)
- Модель данных графа — `src/shared/types/graph.ts` (`GraphNode`/`GraphEdge`/`Graph`,
  с заделом под multi-input через `sourceHandle`/`targetHandle`).
- Каталог фильтров как ДАННЫЕ (`src/shared/lib/ffmpeg/catalog/`): типы `FilterDef`/`FilterParam`,
  4 фильтра с человеческими описаниями (изменить размер, сменить FPS, обрезать, кадрировать),
  у каждого — `toFilterString`. Индекс с `getFilterDef`/`catalogByCategory`.
- `FilterCatalog` рендерится из каталога-данных (категории, поиск по имени/описанию,
  описание «что и зачем» под пунктом); клик добавляет ноду.
- `useGraph` (feature `add-node`) — состояние нод/связей React Flow + `addFilterNode`;
  id через `crypto.randomUUID()`, позиция со сдвигом по числу нод.
- Кастомная нода `FilterNode` (фиолетовая, цвет по типу из UI.md) с хэндлами.
- Тесты каталога — Vitest (9 ✅), реестр в `tests/README.md`.
- Проверено вживую (Playwright): клик в каталоге → нода на холсте, ошибок в консоли нет.
- Фикс N-002: заголовок окна → «FFmpeg Visual». N-001 (стиль контролов React Flow) — в CODE_NOTES.

### Каркас приложения (этап «scaffold»)
- Поднят каркас на Tauri 2 + React 19 + TypeScript (шаблон `create-tauri-app`, Vite).
- Подключены React Flow (`@xyflow/react`), Tailwind CSS v3, Lucide (иконки).
- Tailwind настроен под dark-палитру из [docs/UI.md](docs/UI.md) (slate + зелёный акцент «run»),
  шрифты Inter + JetBrains Mono.
- Собрана пустая раскладка из 4 зон (FSD, `src/widgets/`): `TopBar` (бренд + CTA «Рендер»),
  `PreviewPanel` (превью слева), `NodeCanvas` (холст React Flow с фоном/зумом/мини-картой),
  `FilterCatalog` (каталог справа с поиском и демо-категориями), `CommandBar` (командная
  строка внизу, сворачиваемая — прогрессивное раскрытие).
- Проект переименован в `ffmpeg-visual` / «FFmpeg Visual», окно 1280×800.
- Проверено: `npm run build` зелёный, `npm run tauri dev` собирает Rust и запускает окно.

### Документы и подготовка
- Изучены конкуренты, зафиксировано продуктовое видение ([docs/PRD.md](docs/PRD.md)).
- Выбран стек: Tauri + React + React Flow + TS + Tailwind (Python отклонён осознанно).
- Спроектированы интерфейс ([docs/UI.md](docs/UI.md)) и архитектура ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- Заведены правила ([CLAUDE.md](CLAUDE.md)), регламент ([docs/WORKFLOW.md](docs/WORKFLOW.md)),
  карта доков ([docs/README.md](docs/README.md)) и копилка идей ([docs/IDEAS.md](docs/IDEAS.md)).
