// Сериализация состояния холста (React Flow nodes/edges) в файл проекта (.ffvproj).
// Чистая функция: из React Flow Node[]/Edge[] выдёргивает ТОЛЬКО сохраняемые поля
// (тип, позиция, deletable, params/filterId фильтра, путь доп. входа). Рантайм-поля
// (колбэки, info, invalid) отбрасываются — их восстанавливает useGraph при загрузке.
// Обратная операция — deserialize.ts. См. project.ts (формат).

import type { Node, Edge } from "@xyflow/react";
import type { FilterNodeData } from "../../../widgets/NodeCanvas/nodes/FilterNode";
import type { InputNodeData } from "../../../widgets/NodeCanvas/nodes/InputNode";
import {
  PROJECT_FORMAT,
  PROJECT_VERSION,
  type ProjectFile,
  type ProjectNode,
  type ProjectNodeType,
} from "./project";

// Собрать файл проекта из текущего состояния холста.
// name — имя проекта; inputPath — путь основного входа (он живёт вне data, в useInputFile).
export function serializeProject(
  name: string,
  inputPath: string | null,
  nodes: Node[],
  edges: Edge[],
): ProjectFile {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name,
    inputPath,
    nodes: nodes.map(serializeNode),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      // targetHandle сохраняем только если он есть (нужен merge-нодам in-0/in-1)
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
    })),
  };
}

// Одна нода React Flow → ProjectNode (только сохраняемые поля).
function serializeNode(n: Node): ProjectNode {
  const type = (n.type ?? "filter") as ProjectNodeType;
  const base: ProjectNode = {
    id: n.id,
    type,
    position: { x: n.position.x, y: n.position.y },
  };
  // deletable сохраняем только когда явно задан (основной вход/выход — false, доп. — true)
  if (typeof n.deletable === "boolean") base.deletable = n.deletable;

  if (type === "filter" || type === "merge") {
    const d = n.data as Partial<FilterNodeData>;
    if (d.filterId) base.filterId = d.filterId;
    if (d.params) base.params = { ...d.params };
  } else if (type === "input-file") {
    // Путь хранят только ДОПОЛНИТЕЛЬНЫЕ входы (в своей data). Основной вход (id "input")
    // пути в data не держит — он в ProjectFile.inputPath.
    const d = n.data as Partial<InputNodeData>;
    if (d.path) base.path = d.path;
  }
  return base;
}
