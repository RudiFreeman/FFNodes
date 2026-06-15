// Кастомная нода React Flow для фильтра. Цвет по типу — см. docs/UI.md §2.
// Показывает человеческое имя фильтра; параметры будут редактироваться в следующей итерации.
import { Handle, Position, type NodeProps } from "@xyflow/react";

// Данные, которые кладём в ноду при создании
export interface FilterNodeData {
  label: string; // человеческое имя («Изменить размер»)
  filterId: string; // id из каталога
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function FilterNode({ data }: NodeProps) {
  const d = data as FilterNodeData;
  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-filter bg-surface px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-node-filter" />
      <div className="text-xs font-medium uppercase tracking-wide text-node-filter">
        Фильтр
      </div>
      <div className="text-sm text-fg">{d.label}</div>
      <Handle type="source" position={Position.Right} className="!bg-node-filter" />
    </div>
  );
}
