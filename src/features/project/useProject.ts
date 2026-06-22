// Оркестрация сохранения/открытия проекта (.ffvproj). Связывает чистую сериализацию
// (shared/lib/project) с файловыми диалогами/IO (shared/api/projects) и состоянием холста
// (useGraph) + входа (useInputFile). Сам граф не держит — получает текущее состояние через
// аргументы и колбэки загрузки. См. план Спринта 4, пункт 2.
import { useCallback, useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import {
  pickProjectSaveFile,
  pickProjectOpenFile,
  writeProjectFile,
  readProjectFile,
} from "../../shared/api/projects";
import { serializeProject } from "../../shared/lib/project/serialize";
import { deserializeProject, ProjectFormatError } from "../../shared/lib/project/deserialize";
import { basename } from "../../shared/lib/format";

// Связи с остальным приложением: текущее состояние холста (для сохранения) и колбэки
// восстановления (для открытия).
interface ProjectDeps {
  nodes: Node[];
  edges: Edge[];
  inputPath: string | null;
  // Заменить граф холста загруженным (useGraph.loadGraph)
  loadGraph: (nodes: Node[], edges: Edge[]) => void;
  // Восстановить основной вход: задать путь (loadPath) или сбросить (clear)
  setInputPath: (path: string) => void;
  clearInput: () => void;
}

export function useProject(deps: ProjectDeps) {
  // Имя текущего проекта (для топбара) + путь файла (для «Сохранить» без диалога — на будущее)
  const [name, setName] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Сохранить проект: диалог → serialize → JSON → запись файла.
  const saveProject = useCallback(async () => {
    setError(null);
    const defaultName = `${name ?? "проект"}.ffvproj`;
    const path = await pickProjectSaveFile(defaultName);
    if (!path) return null; // отмена
    const projectName = basename(path).replace(/\.ffvproj$/i, "");
    const file = serializeProject(projectName, deps.inputPath, deps.nodes, deps.edges);
    try {
      await writeProjectFile(path, JSON.stringify(file, null, 2));
      setName(projectName);
      setFilePath(path);
      return { path, name: projectName };
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [name, deps.inputPath, deps.nodes, deps.edges]);

  // Открыть проект по известному пути (из диалога или из списка «Недавние», пункт 4).
  const openProjectFromPath = useCallback(
    async (path: string) => {
      setError(null);
      let text: string;
      try {
        text = await readProjectFile(path);
      } catch (e) {
        setError(String(e));
        return null;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError("Файл проекта повреждён (не JSON).");
        return null;
      }
      try {
        const result = deserializeProject(parsed);
        deps.loadGraph(result.nodes, result.edges);
        // Восстановить основной вход: если путь есть — грузим (ffprobe сам мягко обработает
        // пропавший файл — покажет ошибку, не уронит). Нет пути — сбрасываем вход.
        if (result.inputPath) deps.setInputPath(result.inputPath);
        else deps.clearInput();
        const projectName = basename(path).replace(/\.ffvproj$/i, "");
        setName(projectName);
        setFilePath(path);
        return { path, name: projectName, warnings: result.warnings };
      } catch (e) {
        // ProjectFormatError → понятное сообщение; прочее → как есть
        setError(e instanceof ProjectFormatError ? e.message : String(e));
        return null;
      }
    },
    [deps],
  );

  // Открыть проект через диалог выбора файла.
  const openProject = useCallback(async () => {
    setError(null);
    const path = await pickProjectOpenFile();
    if (!path) return null; // отмена
    return openProjectFromPath(path);
  }, [openProjectFromPath]);

  return { name, filePath, error, saveProject, openProject, openProjectFromPath };
}
