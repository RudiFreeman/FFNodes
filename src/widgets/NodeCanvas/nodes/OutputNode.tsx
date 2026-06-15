// Нода результата. Цвет по типу — см. docs/UI.md §2 (зелёный). Только входящий хэндл.
import { Handle, Position } from "@xyflow/react";

export function OutputNode() {
  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-output bg-surface px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-node-output" />
      <div className="text-xs font-medium uppercase tracking-wide text-node-output">
        Выход
      </div>
      <div className="text-sm text-fg">Результат</div>
    </div>
  );
}
