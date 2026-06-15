// Корневой компонент: компонует раскладку FFmpeg Visual из четырёх зон и связывает
// каталог с холстом через общее состояние графа (useGraph).
// Раскладка по docs/UI.md §4. Архитектура графа — docs/ARCHITECTURE.md.
import { ReactFlowProvider } from "@xyflow/react";
import { TopBar } from "./widgets/TopBar/TopBar";
import { PreviewPanel } from "./widgets/PreviewPanel/PreviewPanel";
import { NodeCanvas } from "./widgets/NodeCanvas/NodeCanvas";
import { FilterCatalog } from "./widgets/FilterCatalog/FilterCatalog";
import { CommandBar } from "./widgets/CommandBar/CommandBar";
import { useGraph } from "./features/add-node/useGraph";
import "./App.css";

function App() {
  const graph = useGraph();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar />

      {/* Средний ряд: превью | холст | каталог */}
      <div className="flex min-h-0 flex-1">
        <PreviewPanel />
        <NodeCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          onNodesChange={graph.onNodesChange}
          onEdgesChange={graph.onEdgesChange}
          onConnect={graph.onConnect}
        />
        <FilterCatalog onAddFilter={graph.addFilterNode} />
      </div>

      <CommandBar command={graph.command} />
    </div>
  );
}

// ReactFlowProvider нужен, чтобы хуки состояния React Flow работали в App (вне <ReactFlow>)
export default function AppWithProvider() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
