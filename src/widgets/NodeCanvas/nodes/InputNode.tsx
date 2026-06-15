// Нода входного файла. Цвет по типу — см. docs/UI.md §2 (синий). Только исходящий хэндл.
// Показывает базовую сводку характеристик загруженного видео (data.info из useGraph).
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MediaInfo } from "../../../shared/types/media";
import { MediaSummary } from "../../../shared/ui/MediaSummary";

export interface InputNodeData {
  info: MediaInfo | null;
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function InputNode({ data }: NodeProps) {
  const d = data as InputNodeData;
  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-input bg-surface px-3 py-2 shadow-md">
      <div className="text-xs font-medium uppercase tracking-wide text-node-input">
        Вход
      </div>
      <div className="text-sm text-fg">Видеофайл</div>
      {/* Реальные характеристики входа — размер точный (не оценка) */}
      <MediaSummary info={d.info} approxSize={false} />
      <Handle type="source" position={Position.Right} className="!bg-node-input" />
    </div>
  );
}
