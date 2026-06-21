// Обход графа как DAG (направленный ациклический граф) и классификатор линейности.
// Фундамент multi-input этапа: линейная цепочка (chain.ts) — частный случай DAG.
// isLinearGraph — единственный рубильник между «простым -vf путём» (generate как раньше)
// и filter_complex-путём (несколько входов / merge-ноды / ветвление). См. docs/ARCHITECTURE.md.
import type { Graph, GraphNode, GraphEdge } from "../../types/graph";
import { getFilterDef } from "./catalog";

// Входящие рёбра ноды (по target). Порядок — как в graph.edges (стабилен).
export function incomingEdges(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.target === nodeId);
}

// Исходящие рёбра ноды (по source).
export function outgoingEdges(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

// Все выходные ноды графа. Мульти-аутпут (Спринт 3): выходов может быть несколько
// (один вход → N выходов), поэтому единственный output больше не предполагается.
// Порядок — как в graph.nodes (стабилен; задаёт порядок выходных секций команды).
export function outputNodes(graph: Graph): GraphNode[] {
  return graph.nodes.filter((n) => n.kind === "output");
}

// Топологическая сортировка (алгоритм Кана). Возвращает ВСЕ ноды в порядке,
// где каждая идёт после своих предшественников. null — если есть цикл или граф
// не доходит от input(ов) до output (несвязный/оборванный).
// В отличие от orderedFilters (chain.ts) умеет ветвление и слияние потоков.
// Мульти-аутпут (Спринт 3): выходов может быть несколько — проверка целостности ниже
// требует, чтобы КАЖДЫЙ вход доходил до какого-то выхода и КАЖДЫЙ выход был достижим из входа.
export function topoSort(graph: Graph): GraphNode[] | null {
  const inputs = graph.nodes.filter((n) => n.kind === "input");
  const outputs = outputNodes(graph);
  if (inputs.length === 0 || outputs.length === 0) return null;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  // Счётчик входящих рёбер для каждой ноды (in-degree)
  const inDegree = new Map<string, number>();
  for (const n of graph.nodes) inDegree.set(n.id, 0);
  for (const e of graph.edges) {
    // Рёбра на несуществующие ноды игнорируем (защита от мусора)
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Очередь из нод без входящих рёбер — это входы (и любые «висящие» истоки)
  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);

  const order: GraphNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = byId.get(id);
    if (node) order.push(node);
    for (const e of outgoingEdges(graph, id)) {
      const left = (inDegree.get(e.target) ?? 0) - 1;
      inDegree.set(e.target, left);
      if (left === 0) queue.push(e.target);
    }
  }

  // Если обошли не все ноды — остался цикл (его ноды так и не достигли in-degree 0)
  if (order.length !== graph.nodes.length) return null;

  // Проверка целостности (мульти-аутпут): каждый input должен доходить ХОТЯ БЫ до одного
  // выхода, и каждый выход — быть достижим хотя бы из одного входа. Без этого «оборванный»
  // граф (фильтр без связи с выходом, или висящий доп. выход без ветки) прошёл бы topo-sort.
  const outputIds = new Set(outputs.map((o) => o.id));
  if (!inputs.every((inp) => reachesAnyOutput(graph, inp.id, outputIds))) return null;
  if (!outputs.every((out) => reachedFromAnyInput(graph, out.id, inputs))) return null;

  return order;
}

// Доходит ли из startId хотя бы до одной выходной ноды (обход по исходящим рёбрам)?
function reachesAnyOutput(graph: Graph, startId: string, outputIds: Set<string>): boolean {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (outputIds.has(id)) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of outgoingEdges(graph, id)) stack.push(e.target);
  }
  return false;
}

// Достижима ли нода outputId хотя бы из одного входа (обход по входящим рёбрам вверх)?
function reachedFromAnyInput(graph: Graph, outputId: string, inputs: GraphNode[]): boolean {
  const inputIds = new Set(inputs.map((i) => i.id));
  const seen = new Set<string>();
  const stack = [outputId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (inputIds.has(id)) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of incomingEdges(graph, id)) stack.push(e.source);
  }
  return false;
}

// Линеен ли граф — то есть достаточно ли старого «-vf/-af пути» для генерации команды.
// Граф линеен, когда ВСЕ условия выполнены:
//   • ровно один input;
//   • ровно один output (мульти-аутпут идёт filter_complex-путём, Спринт 3);
//   • ни одна нода не объявляет merge (нет overlay/concat/gif-палитры);
//   • у каждой ноды не более одного входящего и одного исходящего ребра (нет ветвления).
// Иначе нужен filter_complex (multi-input / multi-output путь).
export function isLinearGraph(graph: Graph): boolean {
  const inputs = graph.nodes.filter((n) => n.kind === "input");
  if (inputs.length !== 1) return false;
  if (outputNodes(graph).length !== 1) return false;

  for (const n of graph.nodes) {
    if (n.filterId) {
      const def = getFilterDef(n.filterId);
      if (def?.merge) return false; // merge-операция всегда требует filter_complex
    }
    if (incomingEdges(graph, n.id).length > 1) return false; // слияние потоков
    if (outgoingEdges(graph, n.id).length > 1) return false; // ветвление потока
  }
  return true;
}
