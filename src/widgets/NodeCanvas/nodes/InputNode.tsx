// Нода входного файла. Цвет по типу — см. docs/UI.md §2 (синий). Только исходящий хэндл.
// Показывает базовую сводку характеристик загруженного видео (data.info из useGraph).
// Основной вход выбирается через топбар/панель превью; ДОПОЛНИТЕЛЬНЫЕ входы (multi-input,
// для overlay/concat) выбирают файл прямо на ноде — у них задан data.onChoose.
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MediaInfo } from "../../../shared/types/media";
import { MediaSummary } from "../../../shared/ui/MediaSummary";
import { HANDLE_CLASS } from "../../../shared/ui/handleClass";
import { basename } from "../../../shared/lib/format";

export interface InputNodeData {
  info: MediaInfo | null;
  path?: string | null; // путь файла (для дополнительных входов хранится прямо в ноде)
  // Выбор файла на самой ноде — задаётся только для дополнительных входов (multi-input).
  // Основной вход (id "input") выбирается из топбара, у него onChoose нет.
  onChoose?: (nodeId: string) => void;
  nodeId?: string; // собственный id ноды — чтобы onChoose знал, какую ноду обновлять
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function InputNode({ data }: NodeProps) {
  const d = data as InputNodeData;
  const isExtra = typeof d.onChoose === "function"; // дополнительный вход с выбором на ноде

  return (
    <div className="min-w-[140px] rounded-md border-2 border-node-input bg-surface px-3 py-2 shadow-md">
      <div className="text-xs font-medium uppercase tracking-wide text-node-input">
        Вход
      </div>

      {isExtra ? (
        // Дополнительный вход: кнопка выбора файла + имя выбранного
        <>
          <button
            type="button"
            onClick={() => d.onChoose?.(d.nodeId ?? "")}
            className="mt-1 w-full rounded border border-node-input/60 px-2 py-1 text-xs text-fg hover:bg-node-input/10"
          >
            {d.path ? "Сменить файл" : "Выбрать файл"}
          </button>
          {d.path && (
            <div className="mt-1 truncate text-xs text-fg" title={d.path}>
              {basename(d.path)}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm text-fg">Видеофайл</div>
      )}

      {/* Реальные характеристики входа — размер точный (не оценка) */}
      <MediaSummary info={d.info} approxSize={false} />
      <Handle type="source" position={Position.Right} className={`!bg-node-input ${HANDLE_CLASS}`} />
    </div>
  );
}
