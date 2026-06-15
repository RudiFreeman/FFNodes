// Нода входного файла. Цвет по типу — см. docs/UI.md §2 (синий). Только исходящий хэндл.
import { Handle, Position } from "@xyflow/react";

export function InputNode() {
  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-input bg-surface px-3 py-2 shadow-md">
      <div className="text-xs font-medium uppercase tracking-wide text-node-input">
        Вход
      </div>
      <div className="text-sm text-fg">Видеофайл</div>
      <Handle type="source" position={Position.Right} className="!bg-node-input" />
    </div>
  );
}
