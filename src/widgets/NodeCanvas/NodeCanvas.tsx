// Нодовый холст (центр): граф input → filter → output на React Flow.
// Состояние графа приходит сверху (из App через useGraph). Кастомная нода — FilterNode.
// См. docs/UI.md §4, docs/ARCHITECTURE.md.
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnNodesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FilterNode } from "./nodes/FilterNode";
import { InputNode } from "./nodes/InputNode";
import { OutputNode } from "./nodes/OutputNode";

interface NodeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
  onNodesDelete: OnNodesDelete<Node>;
}

export function NodeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodesDelete,
}: NodeCanvasProps) {
  // Регистрация кастомных типов нод (мемо — чтобы не пересоздавать каждый рендер)
  const nodeTypes = useMemo(
    () => ({ filter: FilterNode, "input-file": InputNode, "output-file": OutputNode }),
    [],
  );

  return (
    <main className="relative flex-1 bg-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        fitView
        // Меньший стартовый масштаб: ноды не разворачиваются на весь холст (maxZoom < 1).
        // minZoom чуть ниже дефолта — можно отдалиться сильнее.
        fitViewOptions={{ maxZoom: 0.75, padding: 0.3 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#475569" gap={20} />
        <Controls className="!bg-surface !border-border" />
        <MiniMap
          className="!bg-surface"
          maskColor="rgba(15,23,42,0.6)"
          nodeColor="#8B5CF6"
        />
      </ReactFlow>

      {/* Подсказка, пока на холсте только стартовая пара вход→выход (нет фильтров) */}
      {nodes.every((n) => n.type !== "filter") && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <p className="rounded-md bg-surface/80 px-3 py-1.5 text-sm text-fg-muted">
            Кликни функцию в каталоге справа — она встроится между входом и выходом
          </p>
        </div>
      )}
    </main>
  );
}
