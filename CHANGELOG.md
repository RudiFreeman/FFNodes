# Changelog — FFmpeg Visual

История завершённых этапов. Формат: обратная хронология (новое сверху).

## [Не выпущено]

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
