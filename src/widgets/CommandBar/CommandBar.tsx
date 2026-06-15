// Командная строка (низ): сгенерированная FFmpeg-команда, моноширинно, редактируема, копируема.
// Прогрессивное раскрытие: сворачивается стрелкой (см. docs/UI.md §1, §4).
// На этапе каркаса — заглушка с демо-командой и сворачиванием.
import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";

const DEMO_COMMAND = 'ffmpeg -i input.mp4 -vf "scale=1280:-2" output.mp4';

export function CommandBar() {
  const [open, setOpen] = useState(true);

  return (
    <footer className="shrink-0 border-t border-border bg-surface">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Свернуть команду" : "Развернуть команду"}
          className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-fg-muted transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {open ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden />
          )}
          Команда
        </button>

        {open && (
          <>
            <code className="flex-1 truncate font-mono text-[13px] text-fg">
              {DEMO_COMMAND}
            </code>
            <button
              type="button"
              aria-label="Скопировать команду"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Копировать
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
