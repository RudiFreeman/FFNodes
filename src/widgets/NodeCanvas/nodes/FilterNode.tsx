// Кастомная нода React Flow для фильтра. Цвет по типу — см. docs/UI.md §2 (фиолетовый).
// Показывает имя фильтра и редактируемые параметры; изменения уходят в состояние графа
// через колбэк onParamChange (кладётся в data при создании ноды в useGraph).
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import type { ParamValue } from "../../../shared/types/graph";
import { getFilterDef } from "../../../shared/lib/ffmpeg/catalog";

export interface FilterNodeData {
  label: string; // человеческое имя («Изменить размер»)
  filterId: string; // id из каталога
  params: Record<string, ParamValue>; // текущие значения параметров
  onParamChange: (nodeId: string, paramId: string, value: ParamValue) => void;
  invalid?: boolean; // нода участвует в несочетаемой комбинации (N-007) — подсветить
  invalidReason?: string; // причина для tooltip (текст ошибки валидации)
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function FilterNode({ id, data }: NodeProps) {
  const d = data as FilterNodeData;
  const def = getFilterDef(d.filterId);
  const invalid = d.invalid === true;

  return (
    <div
      className={`relative min-w-[180px] rounded-md border-2 bg-surface px-3 py-2 shadow-md ${
        invalid ? "border-destructive" : "border-node-filter"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-node-filter" />
      {/* Значок-предупреждение при несочетаемой операции; tooltip (title) — причина */}
      {invalid && (
        <span
          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
          title={d.invalidReason || "Несочетаемая операция"}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
        </span>
      )}
      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          invalid ? "text-destructive" : "text-node-filter"
        }`}
      >
        Фильтр
      </div>
      <div className="mb-1.5 text-sm text-fg">{d.label}</div>

      {/* Параметры фильтра — редактируемые поля */}
      {def?.params.map((p) => (
        <label key={p.id} className="mb-1 block">
          <span className="text-xs text-fg-muted">{p.label}</span>
          <input
            type={p.type === "number" ? "number" : "text"}
            value={String(d.params[p.id] ?? "")}
            // nodrag — чтобы клик/ввод в поле не таскал ноду
            className="nodrag w-full rounded bg-surface-2 px-1.5 py-1 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-ring"
            onChange={(e) => {
              const raw = e.target.value;
              const value: ParamValue = p.type === "number" ? Number(raw) : raw;
              d.onParamChange(id, p.id, value);
            }}
          />
        </label>
      ))}

      <Handle type="source" position={Position.Right} className="!bg-node-filter" />
    </div>
  );
}
