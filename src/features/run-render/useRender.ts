// Состояние рендера: выбор выходного файла, запуск FFmpeg, прогресс. См. docs/ARCHITECTURE.md §7.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickOutputFile,
  runFfmpeg,
  onRenderProgress,
  type MediaInfo,
} from "../../shared/api/tauri";
import type { GeneratedCommand } from "../../shared/lib/ffmpeg/generate";
import type { UnlistenFn } from "@tauri-apps/api/event";

export type RenderStatus = "idle" | "running" | "done" | "error";

export function useRender(command: GeneratedCommand, info: MediaInfo | null) {
  const [status, setStatus] = useState<RenderStatus>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

    setStatus("running");
    setPercent(0);
    setError(null);

    // Подписка на прогресс
    unlistenRef.current = await onRenderProgress((p) => setPercent(p));

    try {
      await runFfmpeg(args, info?.duration ?? null);
      setPercent(100);
      setStatus("done");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
    }
  }, [command, info]);

  return { status, percent, error, render };
}
