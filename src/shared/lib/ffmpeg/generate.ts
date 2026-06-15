// Генерация FFmpeg-команды из графа. Сердце проекта — чистая функция без побочных эффектов.
// См. docs/ARCHITECTURE.md §4. MVP: линейная цепочка input → filter… → output, опция -vf.
import type { Graph, GraphNode } from "../../types/graph";
import { getFilterDef } from "./catalog";

export interface GeneratedCommand {
  args: string[]; // аргументы для запуска (НЕ склеенная строка — защита от инъекций)
  display: string; // человекочитаемая команда для показа внизу
  error?: string; // если граф неполон — что именно не так (команду не строим)
}

const PLACEHOLDER_INPUT = "input.mp4";
const PLACEHOLDER_OUTPUT = "output.mp4";

// Имя файла из пути для читаемого display (кроссплатформенно). Логика дублирует
// shared/lib/format.basename, но generate.ts — чистый модуль без зависимостей от UI-утилит.
function fileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

// Обойти граф от input по связям до output, вернуть filter-ноды в порядке цепочки.
// null — если цепочка разорвана (нет пути input→output) или есть цикл.
function orderedFilters(graph: Graph): GraphNode[] | null {
  const input = graph.nodes.find((n) => n.kind === "input");
  const output = graph.nodes.find((n) => n.kind === "output");
  if (!input || !output) return null;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  // следующая нода по исходящей связи (для MVP — одна связь от ноды)
  const nextOf = (id: string) =>
    graph.edges.find((e) => e.source === id)?.target;

  const filters: GraphNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = nextOf(input.id);

  while (current) {
    if (seen.has(current)) return null; // цикл
    seen.add(current);
    if (current === output.id) return filters; // дошли до выхода — цепочка цела
    const node = byId.get(current);
    if (!node || node.kind !== "filter") return null;
    filters.push(node);
    current = nextOf(current);
  }
  return null; // оборвалась, не дойдя до output
}

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

  // Для args — полный путь (запуск); для display — короткое имя файла (читаемость)
  const inputForArgs = inputPath ?? PLACEHOLDER_INPUT;
  const inputForDisplay = inputPath ? fileName(inputPath) : PLACEHOLDER_INPUT;

  // Собрать строки фильтров из значений параметров каждой ноды
  const filterStrings: string[] = [];
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) {
      return { args: [], display: "", error: `Неизвестный фильтр: ${node.filterId}` };
    }
    filterStrings.push(def.toFilterString(node.params));
  }

  // Аргументы массивом: вход, опц. -vf, выход
  const args: string[] = ["-i", inputForArgs];
  if (filterStrings.length > 0) {
    args.push("-vf", filterStrings.join(","));
  }
  args.push(PLACEHOLDER_OUTPUT);

  // display — собираем безопасно для чтения (фильтры в кавычках)
  const parts = ["ffmpeg", "-i", inputForDisplay];
  if (filterStrings.length > 0) {
    parts.push("-vf", `"${filterStrings.join(",")}"`);
  }
  parts.push(PLACEHOLDER_OUTPUT);

  return { args, display: parts.join(" ") };
}
