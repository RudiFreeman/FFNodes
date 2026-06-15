// Типы каталога фильтров. Каталог — это ДАННЫЕ, а не код. См. docs/ARCHITECTURE.md §3.
// Каждая запись описывает одну FFmpeg-операцию: человеческое имя, описание «что и зачем»,
// параметры и как из значений собрать кусок команды.
import type { ParamValue } from "../../../types/graph";

// Тип параметра — определяет, каким контролом его редактировать
export type ParamType = "number" | "string" | "enum" | "boolean";

// Один параметр фильтра
export interface FilterParam {
  id: string; // 'width', 'fps'…
  label: string; // «Ширина» — человеческое имя
  type: ParamType;
  default?: ParamValue;
  options?: string[]; // для enum
  hint?: string; // helper-текст под полем
}

// Определение одного фильтра/операции
export interface FilterDef {
  id: string; // 'scale'
  category: string; // 'Размер / FPS' — для группировки в каталоге
  label: string; // «Изменить размер» — человеческое имя
  description: string; // «Что это и зачем» — ключевая ценность продукта
  params: FilterParam[];
  // Как собрать кусок команды из значений параметров: { width: 1280 } → 'scale=1280:-2'
  toFilterString: (p: Record<string, ParamValue>) => string;
}
