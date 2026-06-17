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
import { bridgesOnDelete, applyBridges } from "./relink";
import { pickInputFile, probeMedia } from "../../shared/api/tauri";
import type { FilterNodeData } from "../../widgets/NodeCanvas/nodes/FilterNode";
import type { InputNodeData } from "../../widgets/NodeCanvas/nodes/InputNode";

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

      // Merge-операция (overlay/concat) имеет несколько входов — её НЕ вставляем линейно
      // в цепочку (это разорвало бы смысл двух входов). Кладём на холст, пользователь сам
      // подключает входы к её именованным хэндлам. Обычный фильтр — авто-вставка как раньше.
      const isMerge = Boolean(def.merge);

      setNodes((prev) => {
        const count = prev.filter((n) => n.type === "filter" || n.type === "merge").length;
        const node: Node = {
          id: newId,
          type: isMerge ? "merge" : "filter",
          position: { x: 280, y: 80 + count * 110 },
          data,
        };
        return [...prev, node];
      });

      if (isMerge) return; // без авто-рёбер — два входа подключает пользователь

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

  // Выбрать файл для ДОПОЛНИТЕЛЬНОГО входа (multi-input): диалог → ffprobe → пишем в data ноды.
  // Основной вход (id "input") выбирается из топбара (useInputFile), сюда не попадает.
  const chooseInputFile = useCallback(
    async (nodeId: string) => {
      const path = await pickInputFile();
      if (!path) return; // отмена выбора
      let info: MediaInfo | null = null;
      try {
        info = await probeMedia(path);
      } catch {
        info = null; // метаданные не прочитались — путь всё равно сохраняем
      }
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, path, info } } : n)),
      );
    },
    [setNodes],
  );

  // Добавить дополнительный вход (для overlay/concat). Файл выбирается на самой ноде.
  const addInputNode = useCallback(() => {
    const newId = crypto.randomUUID();
    setNodes((prev) => {
      const inputCount = prev.filter((n) => n.type === "input-file").length;
      const data: InputNodeData = {
        info: null,
        path: null,
        onChoose: chooseInputFile,
        nodeId: newId,
      };
      const node: Node = {
        id: newId,
        type: "input-file",
        position: { x: 80, y: 360 + (inputCount - 1) * 140 },
        data,
        deletable: true, // дополнительные входы можно удалять (в отличие от основного)
      };
      return [...prev, node];
    });
  }, [setNodes, chooseInputFile]);

  // Соединение нод пользователем вручную. В один входной хэндл (target+targetHandle) ведёт
  // только ОДНО ребро: при новом подключении к занятому хэндлу старое заменяется. Это важно
  // для merge-нод — каждый именованный вход (основное видео / накладка) принимает один источник.
  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((prev) => {
        const freed = prev.filter(
          (e) => !(e.target === conn.target && (e.targetHandle ?? null) === (conn.targetHandle ?? null)),
        );
        return addEdge(conn, freed);
      }),
    [setEdges],
  );

  // Удаление нод (клавишей Delete или кнопкой × на ноде) — авто-перецепка цепочки:
  // предшественника удаляемой ноды соединяем с её преемником, чтобы не разорвать
  // цепочку (N-003). ВАЖНО: React Flow внутри deleteElements СНАЧАЛА удаляет связанные
  // рёбра (через onEdgesChange), и лишь ПОТОМ зовёт onNodesDelete — поэтому мосты
  // считаем по `edges` из замыкания (полный снимок ДО удаления), а вливаем в `prev`
  // (где рёбра удалённых нод уже вырезаны). applyBridges не добавит дубль-связь.
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const ids = deleted.map((n) => n.id);
      const bridges = bridgesOnDelete(edges, ids);
      setEdges((prev) => applyBridges(prev, bridges));
    },
    [edges, setEdges],
  );

  // Маппинг состояния React Flow → доменный Graph (чистая логика не знает про UI).
  // Для input-нод кладём path в params.path: основной вход (id INPUT_ID) — из пропа inputPath,
  // дополнительные — из своих data.path. Так generateComplexCommand знает путь каждого входа.
  const graph: Graph = useMemo(() => {
    const domainNodes: GraphNode[] = nodes.map((n) => {
      if (n.type === "input-file") {
        const d = n.data as Partial<InputNodeData>;
        const path = n.id === INPUT_ID ? inputPath ?? undefined : d.path ?? undefined;
        const params: Record<string, ParamValue> = path ? { path } : {};
        return {
          id: n.id,
          kind: "input" as const,
          params,
          position: n.position,
        };
      }
      const kind = n.type === "output-file" ? ("output" as const) : ("filter" as const);
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
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        targetHandle: e.targetHandle ?? undefined,
      })),
    };
  }, [nodes, edges, inputPath]);

  // Сгенерированная команда — обновляется при изменении графа или выбранного файла
  const command = useMemo(
    () => generateCommand(graph, inputPath ?? undefined),
    [graph, inputPath],
  );

  // Набор id нод-виновников ошибки валидации (N-007) — для подсветки на холсте
  const invalidIds = useMemo(
    () => new Set(command.invalidNodeIds ?? []),
    [command.invalidNodeIds],
  );

  // Прокинуть флаг invalid + причину в data конфликтных нод, чтобы FilterNode подсветил их
  // красным и показал tooltip. Защита от зацикливания (как в эффекте ниже, см. N-013):
  // меняем массив нод только если флаг/причина фактически изменились.
  const invalidReason = command.error ?? "";
  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((n) => {
        if (n.type !== "filter" && n.type !== "merge") return n;
        const want = invalidIds.has(n.id);
        const d = n.data as { invalid?: boolean; invalidReason?: string };
        const reason = want ? invalidReason : "";
        if ((d.invalid === true) === want && (d.invalidReason ?? "") === reason) return n;
        changed = true;
        return { ...n, data: { ...n.data, invalid: want, invalidReason: reason } };
      });
      return changed ? next : prev;
    });
  }, [invalidIds, invalidReason, setNodes]);

  // Характеристики по input-нодам (для предсказания при слиянии): основной вход — из пропа
  // info, дополнительные — из их data.info (ffprobe в chooseInputFile).
  const inputInfos = useMemo(() => {
    const map = new Map<string, MediaInfo | null>();
    for (const n of nodes) {
      if (n.type !== "input-file") continue;
      map.set(n.id, n.id === INPUT_ID ? info ?? null : (n.data as Partial<InputNodeData>).info ?? null);
    }
    return map;
  }, [nodes, info]);

  // Пути по input-нодам (id → path) для превью-кадра DAG (filter_complex). Только входы
  // с известным путём (без пути в filter_complex участвовать не могут).
  const inputPaths = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      if (n.type !== "input-file") continue;
      const p = n.id === INPUT_ID ? inputPath ?? undefined : (n.data as Partial<InputNodeData>).path ?? undefined;
      if (p) map.set(n.id, p);
    }
    return map;
  }, [nodes, inputPath]);

  // Предсказанные характеристики результата — пересчитываются на лету из графа и входов
  const predictedOutput = useMemo(
    () => predictOutput(graph, info ?? null, inputInfos),
    [graph, info, inputInfos],
  );

  // Синхронизировать характеристики в data стартовых нод (вход — info, выход — предсказание),
  // чтобы InputNode/OutputNode их отрисовали. По аналогии с onParamChange (пишем в data).
  // ВАЖНО — защита от зацикливания: setNodes → новый `nodes` → новый useMemo `graph` →
  //   `predictOutput` отдаёт НОВЫЙ объект с тем же содержимым → эффект снова → setNodes…
  //   («Maximum update depth exceeded»). Поэтому сравниваем по СОДЕРЖИМОМУ (а не по ссылке):
  //   если info и предсказание не изменились фактически — возвращаем prev и цикл рвётся.
  useEffect(() => {
    setNodes((prev) => {
      // Только ОСНОВНОЙ вход (INPUT_ID) синхронизируем с info из топбара — у дополнительных
      // входов свой info (из их собственного ffprobe в chooseInputFile), его не трогаем.
      const input = prev.find((n) => n.id === INPUT_ID);
      const output = prev.find((n) => n.type === "output-file");
      const nextInfo = info ?? null;
      const sameContent = (a: unknown, b: unknown) =>
        a === b || JSON.stringify(a) === JSON.stringify(b);
      const inputSame = sameContent((input?.data as { info?: unknown })?.info, nextInfo);
      const outputSame = sameContent((output?.data as { info?: unknown })?.info, predictedOutput);
      // Фактически ничего не изменилось — не создаём новый массив нод (разрывает цикл)
      if (inputSame && outputSame) return prev;
      return prev.map((n) => {
        if (n.id === INPUT_ID) return { ...n, data: { ...n.data, info: nextInfo } };
        if (n.type === "output-file") return { ...n, data: { ...n.data, info: predictedOutput } };
        return n;
      });
    });
  }, [info, predictedOutput, setNodes]);

  return {
    nodes,
    edges,
    graph, // доменный Graph — для превью-кадра (usePreviewFrame) и др. чистой логики
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodesDelete,
    addFilterNode,
    addInputNode,
    command,
    predictedOutput,
    inputPaths, // пути входов (id → path) — для превью-кадра DAG (usePreviewFrame)
  };
}
