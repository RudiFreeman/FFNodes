// Тонкая линия прогресса рендера под TopBar. Видна только во время рендера.
// См. docs/UI.md §4 (зона «Линия прогресса»).
interface ProgressBarProps {
  visible: boolean;
  percent: number; // 0..100
}

export function ProgressBar({ visible, percent }: ProgressBarProps) {
  if (!visible) return null;
  return (
    <div
      className="h-0.5 w-full shrink-0 bg-surface-2"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-accent transition-[width] duration-200 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
