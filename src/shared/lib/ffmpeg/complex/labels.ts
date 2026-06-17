// Аллокатор лейблов потоков для filter_complex. Чистый счётчик: выдаёт свежие
// уникальные имена промежуточных потоков ("v1", "v2"… / "a1", "a2"…). Самое тонкое
// место генерации — поэтому изолировано и плотно покрыто тестами. См. complex/build.ts.
import type { StreamLabel } from "./types";

// Создать аллокатор. Возвращает функции выдачи следующего видео/аудио лейбла.
// Имена не пересекаются с входными ("0:v" и т.п.), т.к. те содержат двоеточие.
export function makeLabeler() {
  let videoCounter = 0;
  let audioCounter = 0;
  return {
    // Следующий промежуточный видеолейбл: "v1", "v2"…
    nextVideo(): StreamLabel {
      videoCounter += 1;
      return `v${videoCounter}`;
    },
    // Следующий промежуточный аудиолейбл: "a1", "a2"…
    nextAudio(): StreamLabel {
      audioCounter += 1;
      return `a${audioCounter}`;
    },
  };
}

// Лейбл входа ffmpeg по индексу файла и типу потока: inputLabel(0, "v") → "0:v".
export function inputLabel(inputIndex: number, kind: "v" | "a"): StreamLabel {
  return `${inputIndex}:${kind}`;
}

// Обернуть лейбл в скобки для строки filter_complex: bracket("v1") → "[v1]".
export function bracket(label: StreamLabel): string {
  return `[${label}]`;
}
