// Корневой компонент: компонует раскладку FFmpeg Visual из четырёх зон.
// Раскладка по docs/UI.md §4: TopBar сверху, превью слева, холст в центре,
// каталог справа, командная строка внизу.
import { TopBar } from "./widgets/TopBar/TopBar";
import { PreviewPanel } from "./widgets/PreviewPanel/PreviewPanel";
import { NodeCanvas } from "./widgets/NodeCanvas/NodeCanvas";
import { FilterCatalog } from "./widgets/FilterCatalog/FilterCatalog";
import { CommandBar } from "./widgets/CommandBar/CommandBar";
import "./App.css";

function App() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar />

      {/* Средний ряд: превью | холст | каталог */}
      <div className="flex min-h-0 flex-1">
        <PreviewPanel />
        <NodeCanvas />
        <FilterCatalog />
      </div>

      <CommandBar />
    </div>
  );
}

export default App;
