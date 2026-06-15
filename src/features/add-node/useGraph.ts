// Состояние графа холста + добавление нод из каталога. См. docs/ARCHITECTURE.md §8.
// На этапе каркаса связи (edges) ведём, но авто-соединение нод — в следующей итерации.
import { useCallback } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import type { FilterDef } from "../../shared/lib/ffmpeg/catalog";
import type { FilterNodeData } from "../../widgets/NodeCanvas/nodes/FilterNode";

export function useGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Добавить ноду-фильтр из каталога. Раскладываем со сдвигом по числу уже имеющихся нод,
  // чтобы новые не накладывались друг на друга.
  const addFilterNode = useCallback(
    (def: FilterDef) => {
      const data: FilterNodeData = { label: def.label, filterId: def.id };
      setNodes((prev) => {
        const offset = prev.length % 5;
        const node: Node = {
          id: crypto.randomUUID(),
          type: "filter",
          position: { x: 120 + offset * 40, y: 80 + offset * 60 },
          data,
        };
        return [...prev, node];
      });
    },
    [setNodes],
  );

  // Соединение нод пользователем (тянем связь между хэндлами)
  const onConnect = useCallback(
    (conn: Connection) => setEdges((prev) => addEdge(conn, prev)),
    [setEdges],
  );

  return { nodes, edges, onNodesChange, onEdgesChange, onConnect, addFilterNode };
}
