// Состояние превью-кадра «До»/«После». Тянет кадры через FFmpeg (→ JPG).
// «До» — кадр исходника (основного входа) при смене файла. «После» — тот же момент,
// прогнанный через граф: линейный граф → -vf (extract_frame), DAG (merge/несколько входов)
// → filter_complex (extract_frame_complex). Пересчёт с дебаунсом. См. docs/ARCHITECTURE.md §7.
import { useEffect, useRef, useState } from "react";
import { extractFrame, extractFrameComplex } from "../../shared/api/tauri";
import { previewPlan, previewMoment } from "../../shared/lib/ffmpeg/frame";
import type { Graph } from "../../shared/types/graph";

// Дебаунс пересчёта «После»: ждём, пока пользователь перестанет менять граф.
const AFTER_DEBOUNCE_MS = 400;

// Момент кадра: середина видео информативнее нулевого (часто чёрного) кадра.
function frameMoment(duration: number | null | undefined): number {
  return duration && duration > 0 ? duration / 2 : 0;
}

export interface PreviewFrameState {
  before: string | null; // URL кадра «До» (asset-протокол) или null
  after: string | null; // URL кадра «После»; равен before, если граф ничего не меняет
  loadingBefore: boolean;
  loadingAfter: boolean;
  error: string | null;
}

// path — путь ОСНОВНОГО входа (для «До»). inputPaths — пути всех входов (id → path) для DAG.
export function usePreviewFrame(
  path: string | null,
  graph: Graph,
  duration: number | null,
  inputPaths: Map<string, string>,
) {
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [loadingAfter, setLoadingAfter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Токены актуальности: поздний ответ устаревшего запроса не должен перетирать свежий кадр.
  const beforeToken = useRef(0);
  const afterToken = useRef(0);

  // Кадр «До» — при смене основного файла (или его длительности)
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

  // План кадра «После»: линейный (vf) или DAG (filter_complex). null — граф не собран.
  const plan = path ? previewPlan(graph, inputPaths) : null;
  // Стабильный ключ для эффекта (план — объект, пересоздаётся каждый рендер).
  const planKey = JSON.stringify(plan);

  // Когда строить «После» нечего — зеркалим «До»:
  //   • граф не собран (plan === null);
  //   • линейный граф без видеофильтров (vf === "").
  // Отдельный эффект: смена `before` не должна дёргать дебаунс-таймер ниже.
  const mirrorBefore = plan === null || (plan.kind === "vf" && plan.vf === "");
  useEffect(() => {
    if (mirrorBefore) setAfter(before);
  }, [mirrorBefore, before]);

  // Момент кадра «После» учитывает обрезку по времени (N-012): при trim берём кадр ВНУТРИ
  // обрезанного диапазона, а не середину исходника (она может выпасть из результата).
  // «До» остаётся на середине исходника (это исходный файл, trim к нему не применён).
  const afterMoment = previewMoment(graph, duration);

  // Кадр «После» — пересчёт с дебаунсом при изменении плана (когда есть что строить).
  // Зависит от planKey/afterMoment, но НЕ от before — иначе догрузка «До» сбрасывала бы дебаунс.
  useEffect(() => {
    if (!path || mirrorBefore || !plan) return;

    const handle = setTimeout(() => {
      const token = ++afterToken.current;
      setLoadingAfter(true);
      const request =
        plan.kind === "vf"
          ? extractFrame(path, plan.vf, afterMoment)
          : extractFrameComplex(plan.spec.inputs, plan.spec.filterComplex, plan.spec.mapVideo, afterMoment);
      request
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
    // planKey стабилизирует объект plan; plan/path/afterMoment/mirrorBefore читаем внутри
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, planKey, afterMoment, mirrorBefore]);

  return { before, after, loadingBefore, loadingAfter, error } satisfies PreviewFrameState;
}
