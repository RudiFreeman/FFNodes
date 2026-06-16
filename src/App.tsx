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
import { useFavorites } from "./features/favorites/useFavorites";
import { usePreviewFrame } from "./features/preview-frame/usePreviewFrame";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./App.css";

function App() {
  const input = useInputFile();
  const graph = useGraph(input.path, input.info);
  const render = useRender(graph.command, input.info);
  const favorites = useFavorites();
  // Кадры превью «До»/«После» из исходника и vf-цепочки графа
  const frame = usePreviewFrame(input.path, graph.graph, input.info?.duration ?? null);

  // Рендерить можно, если граф собран в команду и выбран входной файл
  const canRender = !graph.command.error && Boolean(input.path);

  // Колонка «После» в панели: реальные метаданные после рендера (точные, вкл. размер файла),
  // а пока не отрендерили — живое предсказание из графа.
  const afterInfo = render.outputInfo ?? graph.predictedOutput;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar
        onRender={render.render}
        onCancel={render.cancel}
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
          outputInfo={afterInfo}
          rendered={render.outputInfo != null}
          frame={frame}
          onChoose={input.choose}
        />
        <NodeCanvas
          nodes={graph.nodes}
          edges={graph.edges}
          onNodesChange={graph.onNodesChange}
          onEdgesChange={graph.onEdgesChange}
          onConnect={graph.onConnect}
          onNodesDelete={graph.onNodesDelete}
        />
        <FilterCatalog
          onAddFilter={graph.addFilterNode}
          isFavorite={favorites.isFavorite}
          onToggleFavorite={favorites.toggleFavorite}
        />
      </div>

      <CommandBar command={graph.command} />
    </div>
  );
}

// ReactFlowProvider нужен, чтобы хуки состояния React Flow работали в App (вне <ReactFlow>)
export default function AppWithProvider() {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}
