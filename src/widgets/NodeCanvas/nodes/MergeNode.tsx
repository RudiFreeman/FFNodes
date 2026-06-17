// Нода merge-операции (overlay/concat) — два ИМЕНОВАННЫХ входных хэндла (multi-input).
// Цвет — node-filter (как обычные операции). Handle id = in-0, in-1… (порядок = vIn в
// toComplex); подписи берём из def.merge.inputLabels. Build.ts сортирует входы по
// targetHandle, поэтому in-0 < in-1 сохраняет порядок «основной → накладка». См. complex/build.ts.
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { X, AlertTriangle } from "lucide-react";
import type { ParamValue } from "../../../shared/types/graph";
import { getFilterDef } from "../../../shared/lib/ffmpeg/catalog";
import { NodeParams } from "./NodeParams";

export interface MergeNodeData {
  label: string; // человеческое имя («Наложить поверх»)
  filterId: string; // id из каталога (overlay/concat)
  params: Record<string, ParamValue>;
  onParamChange: (nodeId: string, paramId: string, value: ParamValue) => void;
  invalid?: boolean;
  invalidReason?: string;
  [key: string]: unknown;
}

// Id хэндла входа по индексу — должен совпадать с порядком vIn в merge.toComplex.
export function mergeHandleId(index: number): string {
  return `in-${index}`;
}

export function MergeNode({ id, data }: NodeProps) {
  const d = data as MergeNodeData;
  const def = getFilterDef(d.filterId);
  const invalid = d.invalid === true;
  const { deleteElements } = useReactFlow();

  const count = def?.merge?.videoInputs ?? 2;
  const labels = def?.merge?.inputLabels ?? [];
  const inputs = Array.from({ length: count }, (_, i) => ({
    handleId: mergeHandleId(i),
    label: labels[i] ?? `Вход ${i + 1}`,
    // Равномерно распределяем хэндлы по левому краю
    top: `${((i + 1) / (count + 1)) * 100}%`,
  }));

  return (
    <div
      className={`group relative min-w-[200px] rounded-md border-2 bg-surface px-3 py-2 shadow-md ${
        invalid ? "border-destructive" : "border-node-filter"
      }`}
    >
      {/* Несколько именованных входных хэндлов с подписями */}
      {inputs.map((inp) => (
        <Handle
          key={inp.handleId}
          type="target"
          id={inp.handleId}
          position={Position.Left}
          style={{ top: inp.top }}
          className="!bg-node-filter"
        />
      ))}

      <button
        type="button"
        aria-label="Удалить операцию"
        title="Удалить операцию"
        className="nodrag absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-fg-muted opacity-0 transition hover:text-destructive focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring group-hover:opacity-100"
        onClick={() => deleteElements({ nodes: [{ id }] })}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
      {invalid && (
        <span
          className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
          title={d.invalidReason || "Не хватает входа"}
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
        </span>
      )}

      <div
        className={`text-xs font-medium uppercase tracking-wide ${
          invalid ? "text-destructive" : "text-node-filter"
        }`}
      >
        Слияние
      </div>
      <div className="mb-1.5 text-sm text-fg">{d.label}</div>

      {/* Подписи входов — какой хэндл за что отвечает (основное видео / накладка) */}
      <div className="mb-1.5 space-y-0.5">
        {inputs.map((inp) => (
          <div key={inp.handleId} className="text-[10px] text-fg-muted">
            ◖ {inp.label}
          </div>
        ))}
      </div>

      <NodeParams nodeId={id} def={def} params={d.params} onParamChange={d.onParamChange} />

      <Handle type="source" position={Position.Right} className="!bg-node-filter" />
    </div>
  );
}
