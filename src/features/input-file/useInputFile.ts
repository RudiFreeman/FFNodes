// Состояние входного файла: путь + метаданные (ffprobe). См. docs/ARCHITECTURE.md §6,§7.
import { useCallback, useState } from "react";
import { pickInputFile, probeMedia, type MediaInfo } from "../../shared/api/tauri";
import { safePath } from "../../shared/lib/ffmpeg/safePath";
import { isSupportedVideo } from "../../shared/lib/videoExtensions";

interface InputFileState {
  path: string | null;
  info: MediaInfo | null;
  loading: boolean;
  error: string | null;
}

export function useInputFile() {
  const [state, setState] = useState<InputFileState>({
    path: null,
    info: null,
    loading: false,
    error: null,
  });

  // Общий приём готового пути: показать его, прочитать метаданные (ffprobe).
  // Путь сюда приходит уже обезопашенным (из диалога — pickInputFile; из drop — acceptDroppedPath).
  const loadPath = useCallback(async (path: string) => {
    setState({ path, info: null, loading: true, error: null });
    try {
      const info = await probeMedia(path);
      setState({ path, info, loading: false, error: null });
    } catch (e) {
      setState({ path, info: null, loading: false, error: String(e) });
    }
  }, []);

  // Выбрать файл через системный диалог и прочитать метаданные
  const choose = useCallback(async () => {
    const path = await pickInputFile();
    if (!path) return; // отмена выбора
    await loadPath(path);
  }, [loadPath]);

  // Принять путь из drag&drop. Путь приходит мимо диалога, поэтому ОБЯЗАН пройти safePath
  // (N-004: путь с ведущим «-» иначе примут за флаг ffmpeg) и фильтр по видеорасширению
  // (в диалоге это делает ОС, для drop — мы сами).
  const acceptDroppedPath = useCallback(
    async (rawPath: string) => {
      if (!isSupportedVideo(rawPath)) {
        // Не-видео: показываем ошибку, но НЕ затираем уже выбранный файл (path/info) —
        // иначе случайный дроп картинки поверх рабочего видео сбросил бы весь контекст.
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Перетащи видеофайл (mp4, mov, mkv, avi, webm, m4v, flv, wmv)",
        }));
        return;
      }
      await loadPath(safePath(rawPath));
    },
    [loadPath],
  );

  return { ...state, choose, acceptDroppedPath };
}
