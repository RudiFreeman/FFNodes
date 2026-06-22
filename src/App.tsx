// Корневой компонент: компонует раскладку FFNodes из зон и связывает
// каталог с холстом, файл с превью, кнопку рендера с FFmpeg.
// Раскладка по docs/UI.md §4. Архитектура графа — docs/ARCHITECTURE.md.
import { useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { TopBar } from "./widgets/TopBar/TopBar";
import { ProgressBar } from "./widgets/ProgressBar/ProgressBar";
import { PreviewPanel } from "./widgets/PreviewPanel/PreviewPanel";
import { NodeCanvas } from "./widgets/NodeCanvas/NodeCanvas";
import { FilterCatalog } from "./widgets/FilterCatalog/FilterCatalog";
import { CommandBar } from "./widgets/CommandBar/CommandBar";
import { useGraph } from "./features/add-node/useGraph";
import { useInputFile } from "./features/input-file/useInputFile";
import { useFileDrop } from "./features/input-file/useFileDrop";
import { useRender } from "./features/run-render/useRender";
import { useFavorites } from "./features/favorites/useFavorites";
import { useProject } from "./features/project/useProject";
import { useRecentProjects } from "./features/project/useRecentProjects";
import { usePresets } from "./features/project/usePresets";
import { usePreviewFrame } from "./features/preview-frame/usePreviewFrame";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./App.css";

function App() {
  const input = useInputFile();
  // Перетаскивание файла в окно → грузим в основной вход (как выбор через диалог)
  const drop = useFileDrop(input.acceptDroppedPath);
  const graph = useGraph(input.path, input.info);
  const render = useRender(graph.command, input.info);
  const favorites = useFavorites();

  // Список последних проектов (пункт 4) + сохранение/открытие проекта (пункт 2).
  const recentProjects = useRecentProjects();
  const project = useProject({
    nodes: graph.nodes,
    edges: graph.edges,
    inputPath: input.path,
    loadGraph: graph.loadGraph,
    setInputPath: input.loadPath,
    clearInput: input.clear,
  });

  // Сохранить → запомнить в «Недавние». Открыть → загрузить и запомнить (пропал файл — забыть).
  const handleSave = async () => {
    const saved = await project.saveProject();
    if (saved) recentProjects.remember(saved.path, saved.name);
  };
  const handleOpenPath = async (path: string) => {
    const opened = await project.openProjectFromPath(path);
    if (opened) recentProjects.remember(opened.path, opened.name);
    else recentProjects.forget(path); // не открылся (битый/пропал) — убрать из списка
  };
  const handleOpen = async () => {
    const opened = await project.openProject();
    if (opened) recentProjects.remember(opened.path, opened.name);
  };

  // Выходные ноды графа в порядке (мульти-аутпут: вкладки «После»). Подпись «Выход N».
  const outputs = useMemo(() => {
    const ids = graph.graph.nodes.filter((n) => n.kind === "output").map((n) => n.id);
    return ids.map((id, i) => ({ id, label: ids.length > 1 ? `Выход ${i + 1}` : "Выход" }));
  }, [graph.graph.nodes]);

  // Выбранный выход для колонки «После» (по умолчанию первый; если исчез — откатываемся).
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const activeOutputId =
    selectedOutputId && outputs.some((o) => o.id === selectedOutputId)
      ? selectedOutputId
      : outputs[0]?.id ?? null;

  // Пресеты выходной ветки (пункт 3): применяются к ВЫБРАННОМУ выходу (activeOutputId).
  const presets = usePresets();
  const handleSavePreset = (name: string) => {
    if (activeOutputId) void presets.savePreset(name, graph.graph, activeOutputId);
  };
  const handleApplyPreset = async (name: string) => {
    const steps = await presets.loadPresetSteps(name);
    if (steps && activeOutputId) graph.applyPreset(steps, activeOutputId);
  };

  // Кадры превью «До»/«После» из исходника и графа (линейный → -vf, DAG → filter_complex);
  // «После» — для выбранного выхода (мульти-аутпут).
  const frame = usePreviewFrame(
    input.path,
    graph.graph,
    input.info?.duration ?? null,
    graph.inputPaths,
    activeOutputId ?? undefined,
  );

  // Рендерить можно, если граф собран в команду и выбран входной файл
  const canRender = !graph.command.error && Boolean(input.path);

  // Колонка «После» в панели для ВЫБРАННОГО выхода: реальные метаданные после рендера
  // (по индексу выхода), а пока не отрендерили — живое предсказание ветки этого выхода.
  const activeIndex = outputs.findIndex((o) => o.id === activeOutputId);
  const renderedInfo =
    activeIndex >= 0 ? render.outputInfos[activeIndex] ?? null : render.outputInfo;
  const afterInfo =
    renderedInfo ?? (activeOutputId ? graph.predictedByOutput.get(activeOutputId) ?? null : graph.predictedOutput);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar
        onRender={render.render}
        onCancel={render.cancel}
        rendering={render.status === "running"}
        canRender={canRender}
        projectName={project.name}
        onSave={handleSave}
        onOpen={handleOpen}
        recent={recentProjects.recent}
        onOpenRecent={handleOpenPath}
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
          rendered={renderedInfo != null}
          frame={frame}
          dragging={drop.dragging}
          onChoose={input.choose}
          outputs={outputs}
          selectedOutputId={activeOutputId}
          onSelectOutput={setSelectedOutputId}
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
          onAddInput={graph.addInputNode}
          onAddOutput={graph.addOutputNode}
          isFavorite={favorites.isFavorite}
          onToggleFavorite={favorites.toggleFavorite}
          presetNames={presets.names}
          presetError={presets.error}
          onApplyPreset={handleApplyPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={presets.removePreset}
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
