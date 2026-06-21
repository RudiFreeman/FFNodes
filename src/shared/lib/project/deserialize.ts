// Десериализация файла проекта (.ffvproj) обратно в состояние холста (React Flow nodes/edges).
// Чистая функция, ВСТРЕЧНАЯ к serialize.ts. Содержимому файла НЕ доверяем слепо (его мог
// подменить кто угодно): строго проверяем форму (format/version, массивы, типы полей) и
// бросаем понятную ошибку вместо краша. Восстанавливает ноды БЕЗ рантайм-полей (колбэки
// onParamChange/onChoose/nodeId доклеит useGraph.loadGraph; info/invalid посчитаются заново).
// Пути входов остаются абсолютными — мягкая проверка их существования делается уже в useGraph.

import type { Node, Edge } from "@xyflow/react";
import { PROJECT_FORMAT, PROJECT_VERSION, type ProjectNodeType } from "./project";

// Допустимые типы нод (см. NodeCanvas.tsx nodeTypes).
const NODE_TYPES: ReadonlySet<ProjectNodeType> = new Set<ProjectNodeType>([
  "input-file",
  "output-file",
  "filter",
  "merge",
]);

// Результат разбора: готовые ноды/рёбра для холста + путь основного входа + предупреждения
// (мягкие проблемы, не ломающие открытие — например, пропущенные кривые рёбра).
export interface DeserializeResult {
  nodes: Node[];
  edges: Edge[];
  inputPath: string | null;
  warnings: string[];
}

// Ошибка формата файла проекта — для понятного сообщения пользователю (не голый throw).
export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFormatError";
  }
}

// Разобрать уже распарсенный JSON (unknown) в состояние холста.
// Бросает ProjectFormatError, если это не наш файл / битая форма / несовместимая версия.
export function deserializeProject(raw: unknown): DeserializeResult {
  if (!isRecord(raw)) {
    throw new ProjectFormatError("Файл проекта пуст или повреждён.");
  }
  if (raw.format !== PROJECT_FORMAT) {
    throw new ProjectFormatError("Это не файл проекта FFmpeg Visual.");
  }
  if (typeof raw.version !== "number") {
    throw new ProjectFormatError("В файле проекта не указана версия.");
  }
  if (raw.version > PROJECT_VERSION) {
    throw new ProjectFormatError(
      `Файл создан в более новой версии приложения (${raw.version}). Обнови FFmpeg Visual.`,
    );
  }
  // raw.version < PROJECT_VERSION — здесь будет миграция, когда схема изменится. Пока v1.

  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new ProjectFormatError("В файле проекта повреждены узлы или связи.");
  }

  const warnings: string[] = [];
  const nodes: Node[] = [];
  const seenIds = new Set<string>();

  for (const item of raw.nodes) {
    const node = parseNode(item, warnings);
    if (!node) continue; // кривая нода пропускается с предупреждением
    if (seenIds.has(node.id)) {
      warnings.push(`Повторяющийся id узла «${node.id}» — пропущен.`);
      continue;
    }
    seenIds.add(node.id);
    nodes.push(node);
  }

  const edges: Edge[] = [];
  for (const item of raw.edges) {
    const edge = parseEdge(item, seenIds, warnings);
    if (edge) edges.push(edge);
  }

  const inputPath = typeof raw.inputPath === "string" ? raw.inputPath : null;

  return { nodes, edges, inputPath, warnings };
}

// Разобрать одну ноду. Возвращает null (с предупреждением), если форма недопустима.
function parseNode(item: unknown, warnings: string[]): Node | null {
  if (!isRecord(item) || typeof item.id !== "string") {
    warnings.push("Пропущен узел без идентификатора.");
    return null;
  }
  const type = item.type;
  if (typeof type !== "string" || !NODE_TYPES.has(type as ProjectNodeType)) {
    warnings.push(`Узел «${item.id}» неизвестного типа — пропущен.`);
    return null;
  }
  const position = parsePosition(item.position);

  const node: Node = { id: item.id, type, position, data: {} };
  if (typeof item.deletable === "boolean") node.deletable = item.deletable;

  if (type === "filter" || type === "merge") {
    const data: Record<string, unknown> = {};
    if (typeof item.filterId === "string") data.filterId = item.filterId;
    if (isRecord(item.params)) data.params = sanitizeParams(item.params);
    node.data = data;
  } else if (type === "input-file") {
    if (typeof item.path === "string") node.data = { path: item.path };
  }
  return node;
}

// Разобрать ребро. Отбрасываем рёбра на несуществующие ноды (иначе мусор на холсте).
function parseEdge(item: unknown, nodeIds: Set<string>, warnings: string[]): Edge | null {
  if (
    !isRecord(item) ||
    typeof item.id !== "string" ||
    typeof item.source !== "string" ||
    typeof item.target !== "string"
  ) {
    warnings.push("Пропущена повреждённая связь.");
    return null;
  }
  if (!nodeIds.has(item.source) || !nodeIds.has(item.target)) {
    warnings.push(`Связь «${item.id}» ведёт к отсутствующему узлу — пропущена.`);
    return null;
  }
  const edge: Edge = { id: item.id, source: item.source, target: item.target };
  if (typeof item.targetHandle === "string") edge.targetHandle = item.targetHandle;
  return edge;
}

// Координаты с защитой от мусора (нечисловые → 0).
function parsePosition(p: unknown): { x: number; y: number } {
  if (isRecord(p) && typeof p.x === "number" && typeof p.y === "number") {
    return { x: p.x, y: p.y };
  }
  return { x: 0, y: 0 };
}

// Оставить в params только примитивы, которые поддерживает ParamValue (string|number|boolean).
function sanitizeParams(p: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

// Узкий type guard «это объект-словарь».
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
