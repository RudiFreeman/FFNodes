// Панель пресетов в каталоге (Спринт 4, пункт 3): применить сохранённый пресет к выбранному
// выходу и сохранить ветку выбранного выхода как новый пресет. Пресет — настройки одной
// выходной ветки без привязки к файлу. Логика — в usePresets; здесь только UI.
import { useState } from "react";
import { Bookmark, Plus } from "lucide-react";

interface PresetBarProps {
  names: string[]; // имена сохранённых пресетов
  error: string | null;
  // Применить пресет (по имени) к выбранному выходу
  onApply: (name: string) => void;
  // Сохранить текущую ветку выбранного выхода как пресет с именем
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
}

export function PresetBar({ names, error, onApply, onSave, onDelete }: PresetBarProps) {
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");

  const submitSave = () => {
    const name = draftName.trim();
    if (!name) return;
    onSave(name);
    setDraftName("");
    setSaving(false);
  };

  return (
    <div className="border-b border-border p-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
        Пресеты выхода
      </div>

      {/* Список пресетов: клик — применить к выбранному выходу; × — удалить */}
      {names.length > 0 ? (
        <ul className="mb-1.5 space-y-0.5">
          {names.map((name) => (
            <li key={name} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onApply(name)}
                className="flex-1 truncate rounded px-2 py-1 text-left text-sm text-fg hover:bg-surface-2"
                title={`Применить «${name}» к выбранному выходу`}
              >
                {name}
              </button>
              <button
                type="button"
                onClick={() => onDelete(name)}
                aria-label={`Удалить пресет ${name}`}
                title="Удалить пресет"
                className="shrink-0 rounded px-1.5 py-1 text-xs text-fg-muted opacity-0 transition hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-1.5 px-1 text-xs text-fg-muted">Пока нет сохранённых пресетов.</p>
      )}

      {/* Сохранить текущую ветку выхода как пресет */}
      {saving ? (
        <div className="flex gap-1">
          <input
            type="text"
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitSave();
              if (e.key === "Escape") setSaving(false);
            }}
            placeholder="Имя пресета…"
            className="w-full rounded-md bg-surface-2 px-2 py-1 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={submitSave}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-on-accent hover:opacity-90"
          >
            ОК
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSaving(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
          title="Сохранить ветку выбранного выхода как пресет"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Сохранить выход как пресет
        </button>
      )}

      {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
