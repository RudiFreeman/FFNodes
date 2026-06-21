// Состояние рендера: выбор выходного файла, запуск FFmpeg, прогресс. См. docs/ARCHITECTURE.md §7.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickOutputFile,
  runFfmpeg,
  cancelRender,
  onRenderProgress,
  probeMedia,
  type MediaInfo,
} from "../../shared/api/tauri";
import type { GeneratedCommand } from "../../shared/lib/ffmpeg/generate";
import { substituteOutputs } from "./substituteOutputs";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type RenderStatus = "idle" | "running" | "done" | "error" | "cancelled";

export function useRender(command: GeneratedCommand, info: MediaInfo | null) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [outputInfo, setOutputInfo] = useState<MediaInfo | null>(null);
  // Мульти-аутпут: метаданные «После» по каждому выходу (в порядке выходных секций).
  const [outputInfos, setOutputInfos] = useState<(MediaInfo | null)[]>([]);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  // Флаг «текущий рендер отменён пользователем» — чтобы в catch отличить отмену
  // (показать «Отменено», не ошибку) от настоящего сбоя ffmpeg.
  const cancelledRef = useRef(false);

  // Снять подписку на прогресс при размонтировании
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const render = useCallback(async () => {
    if (command.error || command.args.length === 0) return; // нечего рендерить

    // Плейсхолдеры выходных файлов (мульти-аутпут): по одному save-диалогу на каждый.
    // Одиночный выход — один плейсхолдер (output.mp4), как раньше.
    const placeholders = command.outputPlaceholders ?? [];
    if (placeholders.length === 0) return; // нечего сохранять

    // Спросить путь для каждого выхода (имя по умолчанию output_1.mp4, output_2.mp4…).
    // Отмена любого диалога отменяет весь рендер.
    const chosen: string[] = [];
    for (let i = 0; i < placeholders.length; i++) {
      const defaultName = placeholders.length === 1 ? "output.mp4" : `output_${i + 1}.mp4`;
      const p = await pickOutputFile(defaultName);
      if (!p) return; // отмена — выходим, ничего не запускаем
      chosen.push(p);
    }

    // Подставить выбранные пути в args: каждый плейсхолдер → свой путь (точное совпадение).
    const args = substituteOutputs(command.args, placeholders, chosen);

    // Подписку ставим ДО запуска — иначе теряются ранние события быстрого рендера
    unlistenRef.current = await onRenderProgress((p) => setPercent(p));

    cancelledRef.current = false; // новый рендер — сбрасываем флаг отмены
    setStatus("running");
    setPercent(0);
    setError(null);
    setOutputInfo(null); // сбросить прошлый результат — пока не отрендерили новый
    setOutputInfos([]);

    try {
      await runFfmpeg(args, info?.duration ?? null, chosen);
      setPercent(100);
      setStatus("done");
      setOutputPath(chosen[0]);
      // Прозондировать каждый результат — метаданные «После» по выходам (ffprobe не критичен)
      const infos = await Promise.all(
        chosen.map((p) => probeMedia(p).catch(() => null)),
      );
      setOutputInfos(infos);
      setOutputInfo(infos[0] ?? null); // совместимость: основной/первый выход
    } catch (e) {
      if (cancelledRef.current) {
        // Отмена пользователем — не ошибка: тихо вернуться в спокойное состояние
        setPercent(0);
        setStatus("cancelled");
      } else {
        setError(String(e));
        setStatus("error");
      }
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
    }
  }, [command, info]);

  // Отменить идущий рендер. Помечаем отмену до вызова, чтобы catch в render() её увидел.
  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    await cancelRender();
  }, []);

  return { status, percent, error, outputPath, outputInfo, outputInfos, render, cancel };
}
