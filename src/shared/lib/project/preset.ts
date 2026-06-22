// Пресеты (Спринт 4, пункт 3): сохранённые настройки ОДНОЙ выходной ветки — набор операций
// (фильтры + их params), БЕЗ привязки к входному файлу. Сценарий: настроил выход «1080p H.265
// для Telegram» → сохранил как пресет → применяешь к любому другому выходу/проекту.
// Чистая логика (без UI/Tauri): извлечение ветки из графа и сборка нод при применении.
// Хранилище и диалоги — отдельно (api/projects.ts write_preset/read_preset).
import type { Graph, ParamValue } from "../../types/graph";
import { incomingEdges } from "../ffmpeg/dag";

// Сигнатура и версия формата пресета (отдельно от проекта — у них разная схема).
export const PRESET_FORMAT = "ffmpeg-visual-preset";
export const PRESET_VERSION = 1;

// Одна операция в пресете: ссылка на каталог + значения параметров. Порядок в массиве =
// порядок применения (от входа к выходу).
export interface PresetStep {
  filterId: string;
  params: Record<string, ParamValue>;
}

// Файл пресета.
export interface Preset {
  format: typeof PRESET_FORMAT;
  version: number;
  name: string;
  steps: PresetStep[];
}

// Извлечь линейную ветку выхода: идём от output-ноды вверх по ВХОДЯЩИМ рёбрам, собирая
// фильтр-ноды до первого входа/слияния. merge-ноды и входы НЕ берём (пресет file-agnostic).
// Возвращает шаги в порядке применения (вход → … → выход). null — если ветка содержит
// merge-ноду (такой выход зависит от доп. файлов и пресетом не сохраняется).
export function extractBranch(graph: Graph, outputNodeId: string): PresetStep[] | null {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = byId.get(outputNodeId);
  if (!out || out.kind !== "output") return null;

  const stepsReversed: PresetStep[] = [];
  let currentId = outputNodeId;
  const seen = new Set<string>();

  // Поднимаемся по единственному входящему ребру, пока не дойдём до входа.
  while (true) {
    const incoming = incomingEdges(graph, currentId);
    if (incoming.length === 0) break; // дошли до истока без входа — оборванная ветка, но шаги валидны
    if (incoming.length > 1) return null; // слияние потоков — ветку пресетом не сохранить
    const prevId = incoming[0].source;
    if (seen.has(prevId)) return null; // цикл — защита
    seen.add(prevId);
    const prev = byId.get(prevId);
    if (!prev) break;
    if (prev.kind === "input") break; // дошли до входа — конец ветки
    if (prev.kind === "output") return null; // выход не может быть в середине
    if (!prev.filterId) return null; // нода без операции — не сохраняем
    // merge-операции исключены: их распознаём по нескольким входящим у самой prev (выше) —
    // здесь же просто фиксируем шаг как обычный фильтр.
    stepsReversed.push({ filterId: prev.filterId, params: { ...prev.params } });
    currentId = prevId;
  }

  // Собирали от выхода к входу — разворачиваем в порядок применения
  return stepsReversed.reverse();
}

// Собрать файл пресета из ветки выхода. null — если ветку нельзя сохранить (merge/слияние).
export function buildPreset(name: string, graph: Graph, outputNodeId: string): Preset | null {
  const steps = extractBranch(graph, outputNodeId);
  if (steps === null) return null;
  return { format: PRESET_FORMAT, version: PRESET_VERSION, name, steps };
}

// Ошибка формата пресета — понятное сообщение пользователю.
export class PresetFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresetFormatError";
  }
}

// Разобрать распарсенный JSON в Preset со строгой валидацией формы и версии (не доверяем файлу).
export function parsePreset(raw: unknown): Preset {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new PresetFormatError("Файл пресета повреждён.");
  }
  const r = raw as Record<string, unknown>;
  if (r.format !== PRESET_FORMAT) throw new PresetFormatError("Это не пресет FFNodes.");
  if (typeof r.version !== "number") throw new PresetFormatError("В пресете не указана версия.");
  if (r.version > PRESET_VERSION) {
    throw new PresetFormatError("Пресет создан в более новой версии приложения.");
  }
  if (!Array.isArray(r.steps)) throw new PresetFormatError("В пресете повреждены операции.");

  const steps: PresetStep[] = [];
  for (const item of r.steps) {
    if (typeof item !== "object" || item === null) continue;
    const s = item as Record<string, unknown>;
    if (typeof s.filterId !== "string") continue;
    steps.push({ filterId: s.filterId, params: sanitizeParams(s.params) });
  }
  const name = typeof r.name === "string" ? r.name : "Пресет";
  return { format: PRESET_FORMAT, version: PRESET_VERSION, name, steps };
}

// Оставить в params только примитивы ParamValue.
function sanitizeParams(p: unknown): Record<string, ParamValue> {
  if (typeof p !== "object" || p === null) return {};
  const out: Record<string, ParamValue> = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}
