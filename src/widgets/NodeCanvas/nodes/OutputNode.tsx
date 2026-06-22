// Нода результата. Цвет по типу — см. docs/UI.md §2 (зелёный). Только входящий хэндл.
// Показывает предсказанные характеристики результата (data.info из useGraph — predictedOutput),
// пересчитываемые на лету при изменении графа. Размер — оценка («≈»).
// Мульти-аутпут (Спринт 3): выходов может быть несколько. Основной выход неудаляем,
// дополнительные (deletable) получают кнопку × и подпись «Выход N».
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import type { MediaInfo } from "../../../shared/types/media";
import { MediaSummary } from "../../../shared/ui/MediaSummary";
import { HANDLE_CLASS } from "../../../shared/ui/handleClass";

export interface OutputNodeData {
  info: MediaInfo | null;
  label?: string; // подпись выхода («Выход 2») для мульти-аутпута; основной — без неё
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function OutputNode({ id, data, deletable }: NodeProps) {
  const d = data as OutputNodeData;
  const { deleteElements } = useReactFlow();

  return (
    <div className="group relative min-w-[140px] rounded-md border-2 border-node-output bg-surface px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className={`!bg-node-output ${HANDLE_CLASS}`} />
      {/* Кнопку × показываем только у дополнительных выходов (основной выход неудаляем) */}
      {deletable && (
        <button
          type="button"
          aria-label="Удалить выход"
          title="Удалить выход"
          className="nodrag absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-fg-muted opacity-0 transition hover:text-destructive focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring group-hover:opacity-100"
          onClick={() => deleteElements({ nodes: [{ id }] })}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
      <div className="text-xs font-medium uppercase tracking-wide text-node-output">
        {d.label ?? "Выход"}
      </div>
      <div className="text-sm text-fg">Результат</div>
      {/* Предсказанные характеристики — размер показываем как оценку */}
      <MediaSummary info={d.info} approxSize />
    </div>
  );
}
