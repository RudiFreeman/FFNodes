// Категория «Скорость» — изменение скорости воспроизведения.
// Видео — setpts=PTS/factor; звук синхронно — atempo (N-009).
import type { FilterDef } from "./types";

const CATEGORY = "Скорость";

// Собрать цепочку atempo для произвольного множителя скорости звука.
// Ограничение ffmpeg: один atempo принимает 0.5…2.0. Множитель вне диапазона
// раскладываем в произведение шагов внутри диапазона (atempo=2,atempo=2 для ×4).
// factor>1 ускоряет (делим на 2, пока >2), factor<1 замедляет (умножаем на 0.5, пока <0.5).
export function atempoChain(factor: number): string[] {
  if (!Number.isFinite(factor) || factor <= 0) return [];
  const steps: number[] = [];
  let f = factor;
  while (f > 2.0) {
    steps.push(2.0);
    f /= 2.0;
  }
  while (f < 0.5) {
    steps.push(0.5);
    f /= 0.5; // f*2 — приближаемся к диапазону снизу
  }
  steps.push(f); // остаток уже в пределах [0.5, 2.0]
  // Округляем до разумной точности, убираем «1» (нейтральный шаг ничего не меняет)
  return steps
    .map((s) => Number(s.toFixed(4)))
    .filter((s) => s !== 1)
    .map((s) => `atempo=${s}`);
}

// Изменить скорость видео и синхронно — звук.
export const speed: FilterDef = {
  id: "speed",
  category: CATEGORY,
  label: "Изменить скорость",
  description:
    "Ускоряет или замедляет видео вместе со звуком. Зачем: таймлапс (ускорить в 4×), " +
    "slow-motion (замедлить в 2×). Множитель 2 = вдвое быстрее, 0.5 = вдвое медленнее.",
  params: [
    {
      id: "factor",
      label: "Множитель",
      type: "number",
      default: 2,
      hint: ">1 быстрее, <1 медленнее (напр. 0.5)",
    },
  ],
  // Видео: PTS делится на множитель (factor=2 → setpts=PTS/2, быстрее).
  // Звук: atempo синхронно (цепочка для множителей вне 0.5…2.0). Если у входа нет
  // аудиодорожки, ffmpeg просто игнорирует -af — поэтому needsAudio не ставим.
  toCommand: (p) => {
    const factor = Number(p.factor);
    const atempo = atempoChain(factor);
    return {
      vf: `setpts=PTS/${p.factor}`,
      af: atempo.length > 0 ? atempo.join(",") : undefined,
    };
  },
  streams: { needsVideo: true }, // видеофильтр (setpts) — нужен видеопоток
  // Длительность делится на множитель (×2 → вдвое короче). FPS не меняется.
  applyToInfo: (info, p) => {
    const factor = Number(p.factor);
    return {
      ...info,
      duration: info.duration != null && factor ? info.duration / factor : info.duration,
    };
  },
};
