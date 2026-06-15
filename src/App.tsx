// Корневой компонент: компонует раскладку FFmpeg Visual из зон и связывает
// каталог с холстом, файл с превью, кнопку рендера с FFmpeg.
// Раскладка по docs/UI.md §4. Архитектура графа — docs/ARCHITECTURE.md.
import { ReactFlowProvider } from "@xyflow/react";
import { TopBar } from "./widgets/TopBar/TopBar";
import { ProgressBar } from "./widgets/ProgressBar/ProgressBar";
import { PreviewPanel } from "./widgets/PreviewPanel/PreviewPanel";
import { NodeCanvas } from "./widgets/NodeCanvas/NodeCanvas";
import { FilterCatalog } from "./widgets/FilterCatalog/FilterCatalog";
import { CommandBar } from "./widgets/CommandBar/CommandBar";
import { useGraph } from "./features/add-node/useGraph";
import { useInputFile } from "./features/input-file/useInputFile";
import { useRender } from "./features/run-render/useRender";
import "./App.css";

function App() {
  const input = useInputFile();
  const graph = useGraph(input.path);
  const render = useRender(graph.command, input.info);

  // Рендерить можно, если граф собран в команду и выбран входной файл
  const canRender = !graph.command.error && Boolean(input.path);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar
        onRender={render.render}
        rendering={render.status === "running"}
        canRender={canRender}
      />
      <ProgressBar
        visible={render.status === "running" || render.status === "done"}
        percent={render.percent}
      />

      {/* Средний ряд: превью | холст | каталог */}
      <div className="flex min-h-0 flex-1">
        <PreviewPanel
          path={input.path}
          info={input.info}
          loading={input.loading}
          error={input.error}
          outputInfo={render.outputInfo}
          onChoose={input.choose}
        />
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
