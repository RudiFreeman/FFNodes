// Кастомная нода React Flow для фильтра. Цвет по типу — см. docs/UI.md §2 (фиолетовый).
// Показывает имя фильтра и редактируемые параметры; изменения уходят в состояние графа
// через колбэк onParamChange (кладётся в data при создании ноды в useGraph).
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ParamValue } from "../../../shared/types/graph";
import { getFilterDef } from "../../../shared/lib/ffmpeg/catalog";

export interface FilterNodeData {
  label: string; // человеческое имя («Изменить размер»)
  filterId: string; // id из каталога
  params: Record<string, ParamValue>; // текущие значения параметров
  onParamChange: (nodeId: string, paramId: string, value: ParamValue) => void;
  [key: string]: unknown; // React Flow требует индексируемый тип данных
}

export function FilterNode({ id, data }: NodeProps) {
  const d = data as FilterNodeData;
  const def = getFilterDef(d.filterId);

  return (
    <div className="min-w-[180px] rounded-md border-2 border-node-filter bg-surface px-3 py-2 shadow-md">
      <Handle type="target" position={Position.Left} className="!bg-node-filter" />
      <div className="text-xs font-medium uppercase tracking-wide text-node-filter">
        Фильтр
      </div>
      <div className="mb-1.5 text-sm text-fg">{d.label}</div>

      {/* Параметры фильтра — редактируемые поля. Параметр с showIf показывается,
          только если зависимый параметр имеет нужное значение (напр. «Свои размеры»). */}
      {def?.params
        .filter((p) => !p.showIf || d.params[p.showIf.param] === p.showIf.equals)
        .map((p) => (
          <label key={p.id} className="mb-1 block">
            <span className="text-xs text-fg-muted">{p.label}</span>
            {p.type === "enum" ? (
              // Выпадающий список для перечислимых параметров (пресет, угол поворота…)
              <select
                value={String(d.params[p.id] ?? "")}
                // nodrag — чтобы клик по селекту не таскал ноду
                className="nodrag w-full rounded bg-surface-2 px-1.5 py-1 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => d.onParamChange(id, p.id, e.target.value)}
              >
                {p.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
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
            )}
            {p.hint && <span className="mt-0.5 block text-[10px] text-fg-muted">{p.hint}</span>}
          </label>
        ))}

      <Handle type="source" position={Position.Right} className="!bg-node-filter" />
    </div>
  );
}
