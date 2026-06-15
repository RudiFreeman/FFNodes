// Обход графа: упорядочивание цепочки фильтров от input к output.
// Общий источник правды о порядке цепочки — используется и генератором команды
// (generate.ts), и предсказанием характеристик (predict.ts). См. docs/ARCHITECTURE.md §4.
import type { Graph, GraphNode } from "../../types/graph";

// Обойти граф от input по связям до output, вернуть filter-ноды в порядке цепочки.
// null — если цепочка разорвана (нет пути input→output) или есть цикл.
export function orderedFilters(graph: Graph): GraphNode[] | null {
  const input = graph.nodes.find((n) => n.kind === "input");
  const output = graph.nodes.find((n) => n.kind === "output");
  if (!input || !output) return null;

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  // следующая нода по исходящей связи (для MVP — одна связь от ноды)
  const nextOf = (id: string) =>
    graph.edges.find((e) => e.source === id)?.target;

  const filters: GraphNode[] = [];
  const seen = new Set<string>();
  let current: string | undefined = nextOf(input.id);

  while (current) {
    if (seen.has(current)) return null; // цикл
    seen.add(current);
    if (current === output.id) return filters; // дошли до выхода — цепочка цела
    const node = byId.get(current);
    if (!node || node.kind !== "filter") return null;
    filters.push(node);
    current = nextOf(current);
  }
  return null; // оборвалась, не дойдя до output
}
