// Состояние графа холста + добавление нод + генерация команды. См. docs/ARCHITECTURE.md §4,§8.
// Стартовая пара input→output; добавленный фильтр вставляется в цепочку перед output
// и авто-связывается. Команда генерируется из доменного Graph (маппинг ниже).
import { useCallback, useEffect, useMemo } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import type { FilterDef } from "../../shared/lib/ffmpeg/catalog";
import type { Graph, GraphNode, ParamValue } from "../../shared/types/graph";
import type { MediaInfo } from "../../shared/types/media";
import { generateCommand } from "../../shared/lib/ffmpeg/generate";
import { predictOutput } from "../../shared/lib/ffmpeg/predict";
import type { FilterNodeData } from "../../widgets/NodeCanvas/nodes/FilterNode";

// Фиксированные id стартовых нод (input/output всегда на холсте в MVP)
const INPUT_ID = "input";
const OUTPUT_ID = "output";

// Входная и выходная ноды всегда на холсте — запрещаем их удаление (deletable: false),
// иначе цепочку нельзя будет собрать.
const initialNodes: Node[] = [
  { id: INPUT_ID, type: "input-file", position: { x: 80, y: 200 }, data: {}, deletable: false },
  { id: OUTPUT_ID, type: "output-file", position: { x: 560, y: 200 }, data: {}, deletable: false },
];
const initialEdges: Edge[] = [
  { id: "input-output", source: INPUT_ID, target: OUTPUT_ID },
];

// info — характеристики входного файла (ffprobe). Нода «Вход» показывает их,
// нода «Выход» — предсказание (predictedOutput), пересчитываемое на лету из графа.
export function useGraph(inputPath?: string | null, info?: MediaInfo | null) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Изменение параметра фильтр-ноды → пишем в её data.params
  const onParamChange = useCallback(
    (nodeId: string, paramId: string, value: ParamValue) => {
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const d = n.data as FilterNodeData;
          return { ...n, data: { ...d, params: { ...d.params, [paramId]: value } } };
        }),
      );
    },
    [setNodes],
  );

  // Добавить фильтр: создаём ноду и вставляем её в цепочку прямо перед output.
  // Перецепляем связь, которая вела в output, на новую ноду, а ноду — в output.
  const addFilterNode = useCallback(
    (def: FilterDef) => {
      const newId = crypto.randomUUID();
      const defaults: Record<string, ParamValue> = {};
      for (const p of def.params) if (p.default !== undefined) defaults[p.id] = p.default;

      const data: FilterNodeData = {
        label: def.label,
        filterId: def.id,
        params: defaults,
        onParamChange,
      };

      setNodes((prev) => {
        const count = prev.filter((n) => n.type === "filter").length;
        const node: Node = {
          id: newId,
          type: "filter",
          position: { x: 280, y: 80 + count * 110 },
          data,
        };
        return [...prev, node];
      });

      // Перецепить: то, что входило в output, теперь входит в newId; newId → output
      setEdges((prev) => {
        const toOutput = prev.find((e) => e.target === OUTPUT_ID);
        const rest = prev.filter((e) => e.target !== OUTPUT_ID);
        const prevSource = toOutput?.source ?? INPUT_ID;
        return [
          ...rest,
          { id: `${prevSource}-${newId}`, source: prevSource, target: newId },
          { id: `${newId}-${OUTPUT_ID}`, source: newId, target: OUTPUT_ID },
        ];
      });
    },
    [setNodes, setEdges, onParamChange],
  );

  // Соединение нод пользователем вручную
  const onConnect = useCallback(
    (conn: Connection) => setEdges((prev) => addEdge(conn, prev)),
    [setEdges],
  );

  // Маппинг состояния React Flow → доменный Graph (чистая логика не знает про UI)
  const graph: Graph = useMemo(() => {
    const domainNodes: GraphNode[] = nodes.map((n) => {
      const kind =
        n.type === "input-file" ? "input" : n.type === "output-file" ? "output" : "filter";
      const d = n.data as Partial<FilterNodeData>;
      return {
        id: n.id,
        kind,
        filterId: d.filterId,
        params: d.params ?? {},
        position: n.position,
      };
    });
    return {
      nodes: domainNodes,
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  }, [nodes, edges]);

  // Сгенерированная команда — обновляется при изменении графа или выбранного файла
  const command = useMemo(
    () => generateCommand(graph, inputPath ?? undefined),
    [graph, inputPath],
  );

  // Предсказанные характеристики результата — пересчитываются на лету из графа и входа
  const predictedOutput = useMemo(
    () => predictOutput(graph, info ?? null),
    [graph, info],
  );

  // Синхронизировать характеристики в data стартовых нод (вход — info, выход — предсказание),
  // чтобы InputNode/OutputNode их отрисовали. По аналогии с onParamChange (пишем в data).
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type === "input-file") return { ...n, data: { ...n.data, info: info ?? null } };
        if (n.type === "output-file")
          return { ...n, data: { ...n.data, info: predictedOutput } };
        return n;
      }),
    );
  }, [info, predictedOutput, setNodes]);

  return {
    nodes,
    edges,
    graph, // доменный Graph — для превью-кадра (usePreviewFrame) и др. чистой логики
    onNodesChange,
    onEdgesChange,
    onConnect,
    addFilterNode,
    command,
    predictedOutput,
  };
}
