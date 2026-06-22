// Формат файла проекта FFNodes (.ffvproj). Описывает, ЧТО сохраняется на диск:
// узлы холста (тип, позиция, params фильтра, путь доп. входа), рёбра (с targetHandle для
// merge-нод) и путь основного входа. Рантайм-поля (колбэки, info, invalid) НЕ сохраняются —
// они восстанавливаются при загрузке. См. docs/ARCHITECTURE.md и план Спринта 4.

import type { ParamValue } from "../../types/graph";

// Сигнатура формата — отличает наш .ffvproj от любого другого JSON при открытии.
export const PROJECT_FORMAT = "ffmpeg-visual-project";

// Версия схемы файла проекта. Бампается при несовместимом изменении модели; deserialize
// прогоняет старые версии через миграцию (пока миграций нет — рубильник заложен).
export const PROJECT_VERSION = 1;

// Типы нод React Flow, которые знает приложение (см. NodeCanvas.tsx nodeTypes).
export type ProjectNodeType = "input-file" | "output-file" | "filter" | "merge";

// Одна нода в файле проекта — только сохраняемые поля.
export interface ProjectNode {
  id: string;
  type: ProjectNodeType;
  position: { x: number; y: number };
  deletable?: boolean; // основной вход/выход неудаляемы (false); доп. — true
  filterId?: string; // для filter/merge — ссылка на каталог
  params?: Record<string, ParamValue>; // значения параметров фильтра
  path?: string; // путь файла дополнительного входа (основной — в inputPath проекта)
}

// Одно ребро в файле проекта. targetHandle нужен merge-нодам (порядок входов in-0/in-1).
export interface ProjectEdge {
  id: string;
  source: string;
  target: string;
  targetHandle?: string;
}

// Файл проекта целиком.
export interface ProjectFile {
  format: typeof PROJECT_FORMAT;
  version: number;
  name: string; // человеческое имя проекта (для топбара)
  inputPath: string | null; // путь основного входа (id "input"); null — файл не выбран
  nodes: ProjectNode[];
  edges: ProjectEdge[];
}
