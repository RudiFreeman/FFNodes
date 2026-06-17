// Валидация графа: несочетаемые комбинации операций (N-007). Чистая функция без побочных
// эффектов. Работает по упорядоченной цепочке фильтров (chain.ts) и декларативным тегам
// потоков из каталога (FilterDef.streams). Не строит команду — только находит конфликты.
// См. docs/ARCHITECTURE.md §5.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { topoSort, incomingEdges } from "./dag";

// Одна ошибка валидации: человеческое сообщение + id нод, которые её вызвали (для подсветки).
export interface ValidationError {
  message: string;
  nodeIds: string[];
}

export interface ValidationResult {
  errors: ValidationError[];
}

// Выходные флаги, которые задают ОДНО значение и не должны дублироваться разными операциями
// (N-014): если две ноды выставят, например, разные `-c:v`, ffmpeg возьмёт последний — первая
// операция молча игнорируется. Ключ — флаг, значение — человеческое имя для сообщения.
// Только value-флаги; ключи-переключатели (-vn/-an) повторять безвредно — их тут нет.
const SINGLE_VALUE_FLAGS: Record<string, string> = {
  "-c:v": "видеокодек",
  "-c:a": "аудиокодек",
  "-f": "формат контейнера",
};

// Собрать из outputArgs операции набор «однозначных» флагов, которые она задаёт.
// outputArgs — плоский массив [флаг, значение, флаг, значение…]; берём те флаги из
// SINGLE_VALUE_FLAGS, что в нём встречаются.
function singleValueFlagsOf(outputArgs: string[] | undefined): string[] {
  if (!outputArgs) return [];
  return outputArgs.filter((tok) => tok in SINGLE_VALUE_FLAGS);
}

// Проверить граф на несочетаемые операции. Пустой errors — граф осмыслен.
// Топологию берём через topoSort (DAG: ветвление/слияние); если граф не собран (null) —
// это НЕ наша забота (об этом скажет генератор), валидируем только когда граф цел.
// Поддерживает merge-операции (несколько входов) — отдельное правило ниже.
export function validateGraph(graph: Graph): ValidationResult {
  const errors: ValidationError[] = [];

  // Правило 0 (DAG): merge-нода с незаполненными входами — нельзя построить filter_complex.
  // Проверяем ДО topoSort: незаполненный вход часто рвёт достижимость и topoSort даёт null.
  for (const node of graph.nodes) {
    if (node.kind !== "filter" || !node.filterId) continue;
    const def = getFilterDef(node.filterId);
    const need = def?.merge?.videoInputs ?? 0;
    if (need <= 1) continue; // single-input merge (GIF) и обычные фильтры не проверяем
    const have = incomingEdges(graph, node.id).length;
    if (have < need) {
      errors.push({
        message: `«${def!.label}» нужно ${need} входа — подключи ещё ${need - have}. Добавь вход и соедини его с нодой.`,
        nodeIds: [node.id],
      });
    }
  }
  if (errors.length > 0) return { errors };

  const ordered = topoSort(graph);
  if (ordered === null) return { errors: [] };

  // Собрать ноды по эффекту на потоки (id + читаемое имя для сообщений)
  const dropsVideo: { id: string; label: string }[] = [];
  const dropsAudio: { id: string; label: string }[] = [];
  const needsVideo: { id: string; label: string }[] = [];
  const needsAudio: { id: string; label: string }[] = [];

  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    const s = def?.streams;
    if (!s) continue;
    const entry = { id: node.id, label: def!.label };
    if (s.dropsVideo) dropsVideo.push(entry);
    if (s.dropsAudio) dropsAudio.push(entry);
    if (s.needsVideo) needsVideo.push(entry);
    if (s.needsAudio) needsAudio.push(entry);
  }

  // 1) Видео убрано (-vn), но в цепочке есть операция по видео — она работать не будет
  if (dropsVideo.length > 0 && needsVideo.length > 0) {
    const dropLabel = dropsVideo[0].label;
    const needLabels = needsVideo.map((n) => `«${n.label}»`).join(", ");
    errors.push({
      message: `«${dropLabel}» убирает видеодорожку — операции по видео (${needLabels}) работать не будут. Убери одно из двух.`,
      nodeIds: [...dropsVideo.map((n) => n.id), ...needsVideo.map((n) => n.id)],
    });
  }

  // 2) Убраны и видео (-vn), и звук (-an) — выходной файл будет пустым
  if (dropsVideo.length > 0 && dropsAudio.length > 0) {
    errors.push({
      message: `«${dropsVideo[0].label}» убирает видео, «${dropsAudio[0].label}» — звук. Вместе они дадут пустой файл. Оставь хотя бы одну дорожку.`,
      nodeIds: [...dropsVideo.map((n) => n.id), ...dropsAudio.map((n) => n.id)],
    });
  }

  // 3) Звук убран (-an), но в цепочке есть операция по звуку — она работать не будет
  if (dropsAudio.length > 0 && needsAudio.length > 0) {
    const dropLabel = dropsAudio[0].label;
    const needLabels = needsAudio.map((n) => `«${n.label}»`).join(", ");
    errors.push({
      message: `«${dropLabel}» убирает звуковую дорожку — операции по звуку (${needLabels}) работать не будут. Убери одно из двух.`,
      nodeIds: [...dropsAudio.map((n) => n.id), ...needsAudio.map((n) => n.id)],
    });
  }

  // 4) Две операции задают один и тот же «однозначный» выходной флаг (N-014).
  // Напр. «Сжать видео» и «Сменить кодек» обе кладут -c:v — ffmpeg возьмёт последний,
  // первая операция бессмысленна. Собираем флаг → задавшие его ноды.
  const flagSetters = new Map<string, { id: string; label: string }[]>();
  for (const node of ordered) {
    const def = node.filterId ? getFilterDef(node.filterId) : undefined;
    if (!def) continue;
    const flags = singleValueFlagsOf(def.toCommand(node.params).outputArgs);
    for (const flag of flags) {
      const list = flagSetters.get(flag) ?? [];
      list.push({ id: node.id, label: def.label });
      flagSetters.set(flag, list);
    }
  }
  for (const [flag, setters] of flagSetters) {
    if (setters.length > 1) {
      const what = SINGLE_VALUE_FLAGS[flag];
      const labels = setters.map((s) => `«${s.label}»`).join(" и ");
      errors.push({
        message: `${labels} обе задают ${what} (${flag}) — сработает только последняя, остальные впустую. Оставь одну.`,
        nodeIds: setters.map((s) => s.id),
      });
    }
  }

  return { errors };
}
