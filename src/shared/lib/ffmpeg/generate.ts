// Генерация FFmpeg-команды из графа. Сердце проекта — чистая функция без побочных эффектов.
// См. docs/ARCHITECTURE.md §4. MVP: линейная цепочка input → filter… → output, опция -vf.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";
import { validateGraph } from "./validate";

export interface GeneratedCommand {
  args: string[]; // аргументы для запуска (НЕ склеенная строка — защита от инъекций)
  display: string; // человекочитаемая команда для показа внизу
  error?: string; // если граф неполон/несочетаем — что именно не так (команду не строим)
  invalidNodeIds?: string[]; // ноды-виновники ошибки валидации (для подсветки на холсте)
}

const PLACEHOLDER_INPUT = "input.mp4";
const PLACEHOLDER_OUTPUT = "output.mp4";

// Имя файла из пути для читаемого display (кроссплатформенно). Логика дублирует
// shared/lib/format.basename, но generate.ts — чистый модуль без зависимостей от UI-утилит.
function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

// Порядок цепочки фильтров (input→output) — общая логика в chain.ts.

// inputPath — реальный путь выбранного файла; если не задан, используется плейсхолдер.
export function generateCommand(graph: Graph, inputPath?: string): GeneratedCommand {
  const ordered = orderedFilters(graph);

  if (ordered === null) {
    return {
      args: [],
      display: "",
      error: "Соедини ноды: вход → фильтры → выход",
    };
  }

  // Цепочка цела — проверяем осмысленность комбинации операций (N-007).
  // Несочетаемые операции блокируют рендер с понятным объяснением.
  const { errors } = validateGraph(graph);
  if (errors.length > 0) {
    return {
      args: [],
      display: "",
      error: errors[0].message,
      invalidNodeIds: errors.flatMap((e) => e.nodeIds),
    };
  }

  // Для args — полный путь (запуск); для display — короткое имя файла (читаемость)
  const inputForArgs = inputPath ?? PLACEHOLDER_INPUT;
  const inputForDisplay = inputPath ? fileName(inputPath) : PLACEHOLDER_INPUT;

  // Собрать вклад каждой ноды: vf-фрагменты в цепочку + выходные опции-флаги
  const filterStrings: string[] = [];
  const outputArgs: string[] = [];
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) {
      return { args: [], display: "", error: `Неизвестный фильтр: ${node.filterId}` };
    }
    const contrib = def.toCommand(node.params);
    if (contrib.vf) filterStrings.push(contrib.vf);
    if (contrib.outputArgs) outputArgs.push(...contrib.outputArgs);
  }

  // Порядок FFmpeg: вход → -vf → выходные опции → выход
  const args: string[] = ["-i", inputForArgs];
  if (filterStrings.length > 0) args.push("-vf", filterStrings.join(","));
  args.push(...outputArgs);
  args.push(PLACEHOLDER_OUTPUT);

  // display — для чтения (vf-цепочка в кавычках)
  const parts = ["ffmpeg", "-i", inputForDisplay];
  if (filterStrings.length > 0) parts.push("-vf", `"${filterStrings.join(",")}"`);
  parts.push(...outputArgs);
  parts.push(PLACEHOLDER_OUTPUT);

  return { args, display: parts.join(" ") };
}
