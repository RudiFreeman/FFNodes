// Нодовый холст (центр): граф input → filter → output на React Flow.
// На этапе каркаса — пустой холст с фоном-сеткой, зумом и мини-картой.
// Демо-ноды и логика связей появятся в следующих итерациях. См. docs/UI.md §4, docs/ARCHITECTURE.md.
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function NodeCanvas() {
  return (
    <main className="relative flex-1 bg-bg">
      <ReactFlow
        nodes={[]}
        edges={[]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#475569" gap={20} />
        <Controls className="!bg-surface !border-border" />
        <MiniMap
          className="!bg-surface"
          maskColor="rgba(15,23,42,0.6)"
          nodeColor="#475569"
        />
      </ReactFlow>

      {/* Подсказка поверх пустого холста */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <p className="text-sm text-fg-muted">
          Перетащи функцию из каталога справа, чтобы добавить ноду
        </p>
      </div>
    </main>
  );
}
