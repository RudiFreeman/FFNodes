// Командная строка (низ): сгенерированная FFmpeg-команда, моноширинно, копируема.
// Прогрессивное раскрытие: сворачивается стрелкой (см. docs/UI.md §1, §4).
// Команда приходит сверху (из useGraph через App). Если граф неполон — показываем подсказку.
import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { GeneratedCommand } from "../../shared/lib/ffmpeg/generate";

interface CommandBarProps {
  command: GeneratedCommand;
}

export function CommandBar({ command }: CommandBarProps) {
  const [open, setOpen] = useState(true);

  const hasError = Boolean(command.error);

  const onCopy = () => {
    if (!hasError && command.display) {
      void navigator.clipboard.writeText(command.display);
    }
  };

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
            {hasError ? (
              <span className="flex-1 truncate text-[13px] italic text-fg-muted">
                {command.error}
              </span>
            ) : (
              <code className="flex-1 truncate font-mono text-[13px] text-fg">
                {command.display}
              </code>
            )}
            <button
              type="button"
              aria-label="Скопировать команду"
              onClick={onCopy}
              disabled={hasError}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
