// Состояние рендера: выбор выходного файла, запуск FFmpeg, прогресс. См. docs/ARCHITECTURE.md §7.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickOutputFile,
  runFfmpeg,
  onRenderProgress,
  probeMedia,
  type MediaInfo,
} from "../../shared/api/tauri";
import type { GeneratedCommand } from "../../shared/lib/ffmpeg/generate";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type RenderStatus = "idle" | "running" | "done" | "error";

export function useRender(command: GeneratedCommand, info: MediaInfo | null) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [outputInfo, setOutputInfo] = useState<MediaInfo | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

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
      setError(String(e));
      setStatus("error");
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
    }
  }, [command, info]);

  return { status, percent, error, outputPath, outputInfo, render };
}
