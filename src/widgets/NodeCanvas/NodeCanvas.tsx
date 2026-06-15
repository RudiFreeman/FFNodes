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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FilterNode } from "./nodes/FilterNode";

interface NodeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: OnConnect;
}

export function NodeCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
}: NodeCanvasProps) {
  // Регистрация кастомных типов нод (мемо — чтобы не пересоздавать каждый рендер)
  const nodeTypes = useMemo(() => ({ filter: FilterNode }), []);

  return (
    <main className="relative flex-1 bg-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
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

      {/* Подсказка поверх пустого холста */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-fg-muted">
            Кликни функцию в каталоге справа, чтобы добавить ноду
          </p>
        </div>
      )}
    </main>
  );
}
