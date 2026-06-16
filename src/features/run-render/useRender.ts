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
import type { UnlistenFn } from "@tauri-apps/api/event";

export type RenderStatus = "idle" | "running" | "done" | "error" | "cancelled";

export function useRender(command: GeneratedCommand, info: MediaInfo | null) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [outputInfo, setOutputInfo] = useState<MediaInfo | null>(null);
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

    // Спросить, куда сохранить (имя по умолчанию — output.mp4)
    const outPath = await pickOutputFile("output.mp4");
    if (!outPath) return; // отмена

    // В args последний элемент — плейсхолдер выходного файла, заменяем на выбранный путь
    const args = [...command.args];
    args[args.length - 1] = outPath;

    // Подписку ставим ДО запуска — иначе теряются ранние события быстрого рендера
    unlistenRef.current = await onRenderProgress((p) => setPercent(p));

    cancelledRef.current = false; // новый рендер — сбрасываем флаг отмены
    setStatus("running");
    setPercent(0);
    setError(null);
    setOutputInfo(null); // сбросить прошлый результат — пока не отрендерили новый

    try {
      await runFfmpeg(args, info?.duration ?? null);
      setPercent(100);
      setStatus("done");
      setOutputPath(outPath);
      // Прозондировать результат — метаданные «После» для сравнения с входом
      try {
        setOutputInfo(await probeMedia(outPath));
      } catch {
        setOutputInfo(null); // не критично, если ffprobe не смог
      }
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

  return { status, percent, error, outputPath, outputInfo, render, cancel };
}
