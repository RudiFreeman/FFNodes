// IR (промежуточное представление) для генерации -filter_complex.
// Отделено от CommandContribution: лейблы потоков ([0:v], [v1], [vout]) живут только здесь,
// а не вкрапляются в toCommand обычных фильтров. См. complex/build.ts, docs/ARCHITECTURE.md.

// Лейбл потока в filter_complex. Два вида:
//   • ссылка на вход ffmpeg: "0:v" / "1:a" (N — индекс файла в порядке -i);
//   • именованный промежуточный/выходной: "v1", "a2", "vout", "aout".
// В строке filter_complex лейблы оборачиваются в квадратные скобки: "[v1]".
export type StreamLabel = string;

// Готовый план для сборки команды/превью через filter_complex.
export interface ComplexPlan {
  inputs: string[]; // пути входных файлов в порядке -i (индекс = N в "N:v")
  filterComplex: string; // тело -filter_complex (без самого флага)
  mapVideo: StreamLabel | null; // что мапить в -map для видео (напр. "vout"); null — нет видео
  mapAudio: StreamLabel | null; // что мапить для аудио (напр. "aout"); null — нет/copy
  outputArgs: string[]; // собранные outputArgs всех нод (кодеки, -f и т.п.)
}

// Ошибка построения плана — человеческое сообщение + ноды-виновники (для подсветки).
export interface ComplexError {
  error: string;
  invalidNodeIds?: string[];
}

// Результат buildComplexPlan: либо план, либо ошибка.
export type ComplexResult = ComplexPlan | ComplexError;

// Узкий type guard: отличить ошибку от плана.
export function isComplexError(r: ComplexResult): r is ComplexError {
  return "error" in r;
}
