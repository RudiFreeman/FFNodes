// Состояние превью-кадра «До»/«После». Тянет кадры через extract_frame (FFmpeg → JPG).
// «До» — кадр исходника (генерится при смене файла). «После» — тот же момент, прогнанный
// через vf-цепочку графа (пересчёт с дебаунсом при изменении графа). См. docs/ARCHITECTURE.md §7.
import { useEffect, useRef, useState } from "react";
import { extractFrame } from "../../shared/api/tauri";
import { videoFilterChain } from "../../shared/lib/ffmpeg/frame";
import type { Graph } from "../../shared/types/graph";

// Дебаунс пересчёта «После»: ждём, пока пользователь перестанет менять граф.
const AFTER_DEBOUNCE_MS = 400;

// Момент кадра: середина видео информативнее нулевого (часто чёрного) кадра.
// duration может быть неизвестна (null) — тогда берём начало.
function frameMoment(duration: number | null | undefined): number {
  return duration && duration > 0 ? duration / 2 : 0;
}

export interface PreviewFrameState {
  before: string | null; // URL кадра «До» (asset-протокол) или null
  after: string | null; // URL кадра «После»; равен before, если фильтров нет
  loadingBefore: boolean;
  loadingAfter: boolean;
  error: string | null;
}

export function usePreviewFrame(path: string | null, graph: Graph, duration: number | null) {
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [loadingAfter, setLoadingAfter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Токены актуальности: поздний ответ устаревшего запроса не должен перетирать свежий кадр.
  const beforeToken = useRef(0);
  const afterToken = useRef(0);

  // Кадр «До» — при смене файла (или его длительности)
  const moment = frameMoment(duration);
  useEffect(() => {
    if (!path) {
      setBefore(null);
      setAfter(null);
      return;
    }
    const token = ++beforeToken.current;
    setLoadingBefore(true);
    setError(null);
    extractFrame(path, null, moment)
      .then((url) => {
        if (token !== beforeToken.current) return; // устарел
        setBefore(url);
      })
      .catch((e) => {
        if (token !== beforeToken.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (token === beforeToken.current) setLoadingBefore(false);
      });
  }, [path, moment]);

  // vf-цепочка графа: "" — фильтров нет, null — цепочка разорвана/неполна, иначе строка.
  // Зависит от nodes/edges; служит стабильным ключом для эффектов ниже.
  const vf = path ? videoFilterChain(graph) : null;

  // Когда строить «После» нечего (нет фильтров vf==="" или разрыв vf===null) — «После»
  // зеркалит «До». Отдельный эффект: смена `before` не должна дёргать дебаунс-таймер ниже.
  const mirrorBefore = vf === null || vf === "";
  useEffect(() => {
    if (mirrorBefore) setAfter(before);
  }, [mirrorBefore, before]);

  // Кадр «После» — пересчёт с дебаунсом при изменении vf (только когда фильтры реально есть).
  // Зависит от path/vf/moment, но НЕ от before — иначе догрузка «До» сбрасывала бы дебаунс.
  useEffect(() => {
    if (!path || mirrorBefore) return;

    const handle = setTimeout(() => {
      const token = ++afterToken.current;
      setLoadingAfter(true);
      extractFrame(path, vf as string, moment)
        .then((url) => {
          if (token !== afterToken.current) return;
          setAfter(url);
        })
        .catch((e) => {
          if (token !== afterToken.current) return;
          setError(String(e));
        })
        .finally(() => {
          if (token === afterToken.current) setLoadingAfter(false);
        });
    }, AFTER_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [path, vf, moment, mirrorBefore]);

  return { before, after, loadingBefore, loadingAfter, error } satisfies PreviewFrameState;
}
