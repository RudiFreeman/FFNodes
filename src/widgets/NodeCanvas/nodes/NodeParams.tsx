// Общий рендер редактируемых параметров ноды (используется FilterNode и MergeNode).
// Параметр с showIf показывается, только если зависимый параметр имеет нужное значение.
import type { ParamValue } from "../../../shared/types/graph";
import type { FilterDef } from "../../../shared/lib/ffmpeg/catalog";

interface NodeParamsProps {
  nodeId: string;
  def: FilterDef | undefined;
  params: Record<string, ParamValue>;
  onParamChange: (nodeId: string, paramId: string, value: ParamValue) => void;
}

export function NodeParams({ nodeId, def, params, onParamChange }: NodeParamsProps) {
  if (!def) return null;
  return (
    <>
      {def.params
        .filter((p) => !p.showIf || params[p.showIf.param] === p.showIf.equals)
        .map((p) => (
          <label key={p.id} className="mb-1 block">
            <span className="text-xs text-fg-muted">{p.label}</span>
            {p.type === "enum" ? (
              // Выпадающий список для перечислимых параметров (пресет, угол поворота…)
              <select
                value={String(params[p.id] ?? "")}
                // nodrag — чтобы клик по селекту не таскал ноду
                className="nodrag w-full rounded bg-surface-2 px-1.5 py-1 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => onParamChange(nodeId, p.id, e.target.value)}
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
                value={String(params[p.id] ?? "")}
                // nodrag — чтобы клик/ввод в поле не таскал ноду
                className="nodrag w-full rounded bg-surface-2 px-1.5 py-1 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => {
                  const raw = e.target.value;
                  const value: ParamValue = p.type === "number" ? Number(raw) : raw;
                  onParamChange(nodeId, p.id, value);
                }}
              />
            )}
            {p.hint && <span className="mt-0.5 block text-[10px] text-fg-muted">{p.hint}</span>}
          </label>
        ))}
    </>
  );
}
