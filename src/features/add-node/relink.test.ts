// Тесты перецепки связей при удалении нод (N-003). Чистая логика, без React.
// bridgesOnDelete считает мосты по ПОЛНОМУ снимку связей (до удаления);
// applyBridges вливает их в текущее (уже урезанное React Flow) состояние.
import { describe, it, expect } from "vitest";
import { bridgesOnDelete, applyBridges, type RelinkEdge } from "./relink";

// Хелпер: связь по source→target (id неважен для смысла)
const e = (source: string, target: string): RelinkEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});

// Набор связей по парам source→target (без оглядки на id/порядок)
const pairs = (edges: RelinkEdge[]) =>
  edges.map((x) => `${x.source}->${x.target}`).sort();

// React Flow к моменту onNodesDelete уже удалил рёбра удалённых нод — эмулируем это,
// чтобы тестировать связку bridgesOnDelete + applyBridges как в реальном потоке.
const afterRfRemoval = (full: RelinkEdge[], deletedIds: string[]) => {
  const del = new Set(deletedIds);
  return full.filter((x) => !del.has(x.source) && !del.has(x.target));
};

// Полный сквозной прогон: полный граф + удаляемые → итоговые связи
const relink = (full: RelinkEdge[], deletedIds: string[]) => {
  const bridges = bridgesOnDelete(full, deletedIds);
  return applyBridges(afterRfRemoval(full, deletedIds), bridges);
};

describe("bridgesOnDelete + applyBridges (сквозь поток React Flow)", () => {
  it("удаление средней ноды: input→A→output ⇒ input→output", () => {
    const edges = [e("input", "A"), e("A", "output")];
    expect(pairs(relink(edges, ["A"]))).toEqual(["input->output"]);
  });

  it("удаление в длинной цепочке: input→A→B→output, удаляем A ⇒ input→B→output", () => {
    const edges = [e("input", "A"), e("A", "B"), e("B", "output")];
    expect(pairs(relink(edges, ["A"]))).toEqual(["B->output", "input->B"]);
  });

  it("удаление двух подряд A и B ⇒ input→output", () => {
    const edges = [e("input", "A"), e("A", "B"), e("B", "output")];
    expect(pairs(relink(edges, ["A", "B"]))).toEqual(["input->output"]);
  });

  it("удаление двух несмежных в input→A→B→C→output (A и C) ⇒ input→B→output", () => {
    const edges = [e("input", "A"), e("A", "B"), e("B", "C"), e("C", "output")];
    expect(pairs(relink(edges, ["A", "C"]))).toEqual(["B->output", "input->B"]);
  });

  it("нода без исходящей связи (битый граф): мост не создаём, не падаем", () => {
    const edges = [e("input", "A")];
    expect(pairs(relink(edges, ["A"]))).toEqual([]);
  });

  it("нода без входящей связи: без моста", () => {
    const edges = [e("A", "output")];
    expect(pairs(relink(edges, ["A"]))).toEqual([]);
  });
});

describe("bridgesOnDelete", () => {
  it("пустой список удаляемых ⇒ нет мостов", () => {
    const edges = [e("input", "A"), e("A", "output")];
    expect(bridgesOnDelete(edges, [])).toEqual([]);
  });

  it("мост строится по ПОЛНОМУ снимку (связи удаляемой ноды ещё на месте)", () => {
    const edges = [e("input", "A"), e("A", "output")];
    expect(pairs(bridgesOnDelete(edges, ["A"]))).toEqual(["input->output"]);
  });

  it("самопетля не создаётся (цепочка удалённых ведёт обратно в источник)", () => {
    // input→A→input (искусственный цикл), удаляем A — мост input→input недопустим
    const edges = [e("input", "A"), e("A", "input")];
    expect(bridgesOnDelete(edges, ["A"])).toEqual([]);
  });
});

describe("applyBridges", () => {
  it("не дублирует уже существующую связь", () => {
    // После удаления A осталась прямая input→output; мост такой же — не добавляем
    const current = [e("input", "output")];
    const bridges = [e("input", "output")];
    expect(applyBridges(current, bridges)).toBe(current);
  });

  it("добавляет мост к текущему состоянию", () => {
    const current = [e("input", "x")];
    const bridges = [e("input", "B")];
    expect(pairs(applyBridges(current, bridges))).toEqual(["input->B", "input->x"]);
  });

  it("пустые мосты ⇒ текущее состояние без изменений (та же ссылка)", () => {
    const current = [e("input", "output")];
    expect(applyBridges(current, [])).toBe(current);
  });
});

describe("bridgesOnDelete — merge-ноды (несколько входов)", () => {
  // Связь с именованным входом приёмника (для merge: in-0 основной, in-1 накладка)
  const eh = (source: string, target: string, targetHandle: string): RelinkEdge => ({
    id: `${source}-${target}-${targetHandle}`,
    source,
    target,
    targetHandle,
  });

  it("удаление overlay: мостится только основной вход (in-0), накладка отцепляется", () => {
    // in1 →[in-0] ov; in2 →[in-1] ov; ov → output. Удаляем ov.
    const full = [
      eh("in1", "ov", "in-0"),
      eh("in2", "ov", "in-1"),
      e("ov", "output"),
    ];
    const bridges = bridgesOnDelete(full, ["ov"]);
    // только основной вход (in1) мостится к output; in2 (накладка) — нет
    expect(pairs(bridges)).toEqual(["in1->output"]);
  });

  it("удаление concat: основной (первый ролик) → преемник, второй отцепляется", () => {
    const full = [
      eh("a", "cc", "in-0"),
      eh("b", "cc", "in-1"),
      e("cc", "output"),
    ];
    const bridges = bridgesOnDelete(full, ["cc"]);
    expect(pairs(bridges)).toEqual(["a->output"]);
  });
});
