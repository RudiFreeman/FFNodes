// Нода результата. Цвет по типу — см. docs/UI.md §2 (зелёный). Только входящий хэндл.
// Показывает предсказанные характеристики результата (data.info из useGraph — predictedOutput),
// пересчитываемые на лету при изменении графа. Размер — оценка («≈»).
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MediaInfo } from "../../../shared/types/media";
import { MediaSummary } from "../../../shared/ui/MediaSummary";

export interface OutputNodeData {
  info: MediaInfo | null;
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function OutputNode({ data }: NodeProps) {
  const d = data as OutputNodeData;
  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-output bg-surface px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-node-output" />
      <div className="text-xs font-medium uppercase tracking-wide text-node-output">
        Выход
      </div>
      <div className="text-sm text-fg">Результат</div>
      {/* Предсказанные характеристики — размер показываем как оценку */}
      <MediaSummary info={d.info} approxSize />
    </div>
  );
}
