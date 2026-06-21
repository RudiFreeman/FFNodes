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

// Узкий type guard: отличить ошибку от плана (работает и для ComplexResult, и для
// MultiOutputResult — оба = «план | ошибка»).
export function isComplexError<T>(r: T | ComplexError): r is ComplexError {
  return typeof r === "object" && r !== null && "error" in r;
}

// --- Мульти-аутпут (Спринт 3): один вход → N выходов одной командой (Вариант A) ---

// План одного выхода: какие потоки мапить наружу + его собственные outputArgs (кодек/-f,
// собранные из веток фильтров, ведущих именно к этому выходу) + id output-ноды (для UI/превью).
export interface OutputPlan {
  nodeId: string; // id output-ноды графа (порядок выходных секций = порядок outputNodes)
  mapVideo: StreamLabel | null;
  mapAudio: StreamLabel | null;
  outputArgs: string[];
}

// План мульти-аутпута: общий filter_complex (один декод входа, split на ветки) + список
// выходов. Каждый выход даёт свою секцию команды (-map … outputArgs OUT_i).
export interface MultiOutputPlan {
  inputs: string[]; // пути входов в порядке -i
  filterComplex: string; // общее тело -filter_complex (split-ветки для всех выходов)
  outputs: OutputPlan[]; // по одному на выходную ноду (в порядке outputNodes графа)
}

export type MultiOutputResult = MultiOutputPlan | ComplexError;
