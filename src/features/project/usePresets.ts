// Пресеты выходной ветки (Спринт 4, пункт 3): список из app-config/presets + сохранение
// текущей ветки выхода как пресета и применение пресета к выходу. Чистая логика извлечения/
// разбора — в shared/lib/project/preset.ts; хранилище — Rust (api/projects.ts).
import { useCallback, useEffect, useState } from "react";
import type { Graph } from "../../shared/types/graph";
import {
  listPresets,
  writePreset,
  readPreset,
  deletePreset,
} from "../../shared/api/projects";
import {
  buildPreset,
  parsePreset,
  PresetFormatError,
  type PresetStep,
} from "../../shared/lib/project/preset";

export function usePresets() {
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Обновить список имён пресетов с диска.
  const refresh = useCallback(() => {
    listPresets()
      .then(setNames)
      .catch(() => setNames([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Сохранить ветку выхода как пресет. Возвращает true при успехе; false — если ветку нельзя
  // сохранить (содержит слияние/merge) или ошибка записи.
  const savePreset = useCallback(
    async (name: string, graph: Graph, outputNodeId: string): Promise<boolean> => {
      setError(null);
      const preset = buildPreset(name.trim(), graph, outputNodeId);
      if (!preset) {
        setError("Этот выход нельзя сохранить как пресет (содержит слияние или несколько входов).");
        return false;
      }
      if (preset.steps.length === 0) {
        setError("В этой ветке нет операций для пресета.");
        return false;
      }
      try {
        await writePreset(preset.name, JSON.stringify(preset, null, 2));
        refresh();
        return true;
      } catch (e) {
        setError(String(e));
        return false;
      }
    },
    [refresh],
  );

  // Прочитать пресет по имени → шаги для applyPreset. null — ошибка чтения/формата.
  const loadPresetSteps = useCallback(async (name: string): Promise<PresetStep[] | null> => {
    setError(null);
    try {
      const text = await readPreset(name);
      const preset = parsePreset(JSON.parse(text));
      return preset.steps;
    } catch (e) {
      setError(e instanceof PresetFormatError ? e.message : String(e));
      return null;
    }
  }, []);

  // Удалить пресет.
  const removePreset = useCallback(
    async (name: string) => {
      try {
        await deletePreset(name);
        refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  return { names, error, savePreset, loadPresetSteps, removePreset, refresh };
}
