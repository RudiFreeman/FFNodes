// Валидация графа: несочетаемые комбинации операций (N-007). Чистая функция без побочных
// эффектов. Работает по упорядоченной цепочке фильтров (chain.ts) и декларативным тегам
// потоков из каталога (FilterDef.streams). Не строит команду — только находит конфликты.
// См. docs/ARCHITECTURE.md §5.
import type { Graph } from "../../types/graph";
import { getFilterDef } from "./catalog";
import { orderedFilters } from "./chain";

// Одна ошибка валидации: человеческое сообщение + id нод, которые её вызвали (для подсветки).
export interface ValidationError {
  message: string;
  nodeIds: string[];
}

export interface ValidationResult {
  errors: ValidationError[];
}

// Проверить граф на несочетаемые операции. Пустой errors — граф осмыслен.
// Цепочку берём через orderedFilters; если она разорвана (null) — это НЕ наша забота
// (об этом скажет генератор), валидируем только когда цепочка цела.
export function validateGraph(graph: Graph): ValidationResult {
  const ordered = orderedFilters(graph);
  if (ordered === null) return { errors: [] };

  const errors: ValidationError[] = [];

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

  return { errors };
}
