// Перецепка связей графа при удалении нод. Чистая функция (без React) — тестируемо.
// Задача N-003: удаление фильтра из середины цепочки не должно её рвать —
// предшественник удаляемой ноды соединяется напрямую с её преемником.
//
// ВАЖНО про порядок в React Flow: deleteElements сначала применяет удаление
// связанных рёбер (через onEdgesChange), и только ПОТОМ зовёт onNodesDelete.
// Поэтому мосты нужно считать по ПОЛНОМУ снимку связей (до удаления), а применять
// к уже урезанному состоянию. Отсюда разделение: bridgesOnDelete (что добавить) +
// applyBridges (как влить в текущее состояние без дублей).

// Минимальная форма связи (совместима с React Flow Edge). Берём только нужные поля.
// targetHandle — какой именованный вход приёмника (для merge-нод: in-0 = основной).
export interface RelinkEdge {
  id: string;
  source: string;
  target: string;
  targetHandle?: string | null;
}

// Посчитать «мосты» — новые связи предшественник→преемник для удаляемых нод.
// fullEdges — ПОЛНЫЙ набор связей ДО удаления (со связями удаляемых нод).
// Проходит сквозь цепочку удалённых (удаление нескольких подряд), без самопетель.
//
// Merge-ноды (несколько входов): мостим только ОСНОВНОЙ вход (минимальный targetHandle,
// напр. in-0) к преемнику — он несёт «главный» поток. Остальные входы (накладка/второй
// ролик) просто отцепляются: переносить их к преемнику бессмысленно (преемник принял бы
// несколько потоков). Так удаление overlay/concat оставляет основную цепочку целой.
export function bridgesOnDelete(
  fullEdges: RelinkEdge[],
  deletedIds: string[],
): RelinkEdge[] {
  const deleted = new Set(deletedIds);
  if (deleted.size === 0) return [];

  // Карта source → target по исходным связям (для прохода сквозь удалённые ноды)
  const targetOf = new Map<string, string>();
  for (const e of fullEdges) targetOf.set(e.source, e.target);

  // Ближайший выживший преемник, проходя сквозь удалённые ноды.
  // guard ограничивает обход (защита от цикла среди удалённых).
  const survivingSuccessor = (start: string): string | null => {
    let cur: string | undefined = start;
    let guard = 0;
    while (cur !== undefined && deleted.has(cur) && guard < deleted.size + 1) {
      cur = targetOf.get(cur);
      guard += 1;
    }
    return cur !== undefined && !deleted.has(cur) ? cur : null;
  };

  // Для каждой удаляемой ноды — её ОСНОВНОЙ входящий source (по минимальному targetHandle).
  // Только он будет мостить к преемнику; прочие входы удаляемой ноды игнорируем.
  const primarySourceOf = new Map<string, string>();
  for (const e of fullEdges) {
    if (!deleted.has(e.target)) continue;
    const existing = primarySourceOf.get(e.target);
    if (existing === undefined) {
      primarySourceOf.set(e.target, e.source);
    } else {
      // выбираем меньший targetHandle как «основной» — но сравнивать надо при наличии handle
      // (упрощённо: первый встреченный для нод без handle, иначе меньший handle)
      const curHandle = handleOf(fullEdges, e.target, e.source);
      const exHandle = handleOf(fullEdges, e.target, existing);
      if (curHandle < exHandle) primarySourceOf.set(e.target, e.source);
    }
  }

  const bridges: RelinkEdge[] = [];
  const seen = new Set<string>(); // против дублей мостов
  for (const e of fullEdges) {
    if (deleted.has(e.source)) continue; // источник удалён — не точка входа моста
    if (!deleted.has(e.target)) continue; // не ведёт в удалённую — обычная связь
    // Мостим только основной вход удаляемой ноды (для обычных нод он единственный)
    if (primarySourceOf.get(e.target) !== e.source) continue;
    const successor = survivingSuccessor(e.target);
    if (successor === null || successor === e.source) continue; // некуда мостить
    const key = `${e.source}->${successor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bridges.push({ id: `${e.source}-${successor}`, source: e.source, target: successor });
  }
  return bridges;
}

// targetHandle ребра source→target (для выбора основного входа merge-ноды).
// Отсутствие handle трактуем как наименьший ("") — у обычных нод вход один.
function handleOf(edges: RelinkEdge[], target: string, source: string): string {
  const e = edges.find((x) => x.target === target && x.source === source);
  return e?.targetHandle ?? "";
}

// Влить мосты в текущее состояние связей (после авто-удаления рёбер удалённых нод).
// Не добавляем мост, если такая связь source→target уже есть (защита от дублей/ключей).
export function applyBridges<E extends RelinkEdge>(current: E[], bridges: RelinkEdge[]): E[] {
  if (bridges.length === 0) return current;
  const fresh = bridges.filter(
    (b) => !current.some((e) => e.source === b.source && e.target === b.target),
  );
  if (fresh.length === 0) return current;
  return [...current, ...(fresh as E[])];
}
