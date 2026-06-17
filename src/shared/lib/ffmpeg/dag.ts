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

// Топологическая сортировка (алгоритм Кана). Возвращает ВСЕ ноды в порядке,
// где каждая идёт после своих предшественников. null — если есть цикл или граф
// не доходит от input(ов) до output (несвязный/оборванный).
// В отличие от orderedFilters (chain.ts) умеет ветвление и слияние потоков.
export function topoSort(graph: Graph): GraphNode[] | null {
  const inputs = graph.nodes.filter((n) => n.kind === "input");
  const output = graph.nodes.find((n) => n.kind === "output");
  if (inputs.length === 0 || !output) return null;

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

  // Проверка целостности: output должен быть достижим, а у каждого input — путь к output.
  // Без этого «оборванный» граф (фильтр без связи с output) прошёл бы topo-sort.
  if (!outputReachableFromAllInputs(graph, inputs, output.id)) return null;

  return order;
}

// Достижим ли output из каждого input (обход по исходящим рёбрам)?
function outputReachableFromAllInputs(
  graph: Graph,
  inputs: GraphNode[],
  outputId: string,
): boolean {
  const reaches = (startId: string): boolean => {
    const seen = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === outputId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const e of outgoingEdges(graph, id)) stack.push(e.target);
    }
    return false;
  };
  return inputs.every((inp) => reaches(inp.id));
}

// Линеен ли граф — то есть достаточно ли старого «-vf/-af пути» для генерации команды.
// Граф линеен, когда ВСЕ условия выполнены:
//   • ровно один input;
//   • ни одна нода не объявляет merge (нет overlay/concat/gif-палитры);
//   • у каждой ноды не более одного входящего и одного исходящего ребра (нет ветвления).
// Иначе нужен filter_complex (multi-input путь).
export function isLinearGraph(graph: Graph): boolean {
  const inputs = graph.nodes.filter((n) => n.kind === "input");
  if (inputs.length !== 1) return false;

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
