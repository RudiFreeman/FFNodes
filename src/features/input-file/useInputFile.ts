// Состояние входного файла: путь + метаданные (ffprobe). См. docs/ARCHITECTURE.md §6,§7.
import { useCallback, useState } from "react";
import { pickInputFile, probeMedia, type MediaInfo } from "../../shared/api/tauri";

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

  // Выбрать файл и сразу прочитать его метаданные
  const choose = useCallback(async () => {
    const path = await pickInputFile();
    if (!path) return; // отмена выбора
    setState({ path, info: null, loading: true, error: null });
    try {
      const info = await probeMedia(path);
      setState({ path, info, loading: false, error: null });
    } catch (e) {
      setState({ path, info: null, loading: false, error: String(e) });
    }
  }, []);

  return { ...state, choose };
}
