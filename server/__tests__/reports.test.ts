import { describe, it, expect } from "vitest";
import { monthKey, monthsWindowStart, lastMonthKeys, fillMonthlySeries } from "../lib/reports";

describe("monthKey", () => {
  it("formata YYYY-MM com zero à esquerda", () => {
    expect(monthKey(new Date(2026, 6, 12))).toBe("2026-07");
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
});

describe("monthsWindowStart", () => {
  it("volta ao primeiro dia do mês mais antigo da janela", () => {
    const start = monthsWindowStart(new Date(2026, 6, 12), 12);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(7); // agosto
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
  });

  it("janela de 1 mês é o próprio mês de referência", () => {
    const start = monthsWindowStart(new Date(2026, 6, 12), 1);
    expect(monthKey(start)).toBe("2026-07");
  });
});

describe("lastMonthKeys", () => {
  it("gera as chaves do mais antigo ao atual, atravessando a virada de ano", () => {
    expect(lastMonthKeys(new Date(2026, 1, 15), 4)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02",
    ]);
  });

  it("tamanho da lista é o nº de meses pedido", () => {
    expect(lastMonthKeys(new Date(2026, 6, 12), 12)).toHaveLength(12);
  });
});

describe("fillMonthlySeries", () => {
  const keys = ["2026-05", "2026-06", "2026-07"];

  it("preenche meses sem dados com o valor zero", () => {
    const series = fillMonthlySeries(
      keys,
      [{ month: "2026-06", revenue: 500 }],
      { revenue: 0 },
    );
    expect(series).toEqual([
      { month: "2026-05", revenue: 0 },
      { month: "2026-06", revenue: 500 },
      { month: "2026-07", revenue: 0 },
    ]);
  });

  it("mantém a ordem das chaves mesmo com linhas fora de ordem", () => {
    const series = fillMonthlySeries(
      keys,
      [
        { month: "2026-07", count: 2 },
        { month: "2026-05", count: 7 },
      ],
      { count: 0 },
    );
    expect(series.map(s => s.month)).toEqual(keys);
    expect(series.map(s => s.count)).toEqual([7, 0, 2]);
  });

  it("ignora linhas fora da janela", () => {
    const series = fillMonthlySeries(keys, [{ month: "2024-01", count: 9 }], { count: 0 });
    expect(series.every(s => s.count === 0)).toBe(true);
  });
});
