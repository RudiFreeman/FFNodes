// Модель данных графа. См. docs/ARCHITECTURE.md §2.
// MVP — линейная цепочка (input → filter → output), но структура заложена под multi-input.

// Значение параметра фильтра (заполняется пользователем)
export type ParamValue = string | number | boolean;

// Роль ноды во FFmpeg-команде
export type NodeKind = "input" | "filter" | "output";

// Нода графа
export interface GraphNode {
  id: string; // уникальный (требование React Flow)
  kind: NodeKind;
  filterId?: string; // для filter — ссылка на запись каталога ('scale', 'fps'…)
  params: Record<string, ParamValue>; // значения параметров
  position: { x: number; y: number }; // координаты на холсте
}

// Связь между нодами
export interface GraphEdge {
  id: string;
  source: string; // id ноды-источника
  target: string; // id ноды-приёмника
  // на будущее (multi-input): какой выход/вход соединяем → станут метками пэдов
  sourceHandle?: string;
  targetHandle?: string;
}

// Граф целиком
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
