// Типы каталога фильтров. Каталог — это ДАННЫЕ, а не код. См. docs/ARCHITECTURE.md §3.
// Каждая запись описывает одну FFmpeg-операцию: человеческое имя, описание «что и зачем»,
// параметры и её ВКЛАД в команду (видеофильтр в -vf и/или выходные опции-флаги).
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

// Вклад операции в итоговую команду. Гибкий: операция может дать кусок -vf фильтра
// (склеивается в цепочку с другими через запятую) И/ИЛИ выходные опции-флаги (-c:v, -crf, -an…).
export interface CommandContribution {
  vf?: string; // фрагмент видеофильтра, напр. 'scale=1280:-2'
  outputArgs?: string[]; // флаги выходных опций, напр. ['-c:v', 'libx264', '-crf', '23']
}

// Определение одной операции/фильтра
export interface FilterDef {
  id: string; // 'scale'
  category: string; // 'Размер / FPS' — для группировки в каталоге
  label: string; // «Изменить размер» — человеческое имя
  description: string; // «Что это и зачем» — ключевая ценность продукта
  params: FilterParam[];
  // Как операция вкладывается в команду из значений параметров.
  toCommand: (p: Record<string, ParamValue>) => CommandContribution;
}
