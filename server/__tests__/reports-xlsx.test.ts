import { describe, it, expect } from "vitest";
import { buildReportsWorkbook, formatMonthLabel } from "../lib/reports-xlsx";
import type { ReportsOverview } from "../lib/reports-overview";

const overview: ReportsOverview = {
  months: 6,
  monthly: [
    { month: "2026-06", revenue: 10050, overdueAmount: 0, overdueStudents: 0, newStudents: 2, cancellations: 1 },
    { month: "2026-07", revenue: 20000, overdueAmount: 14000, overdueStudents: 3, newStudents: 1, cancellations: 0 },
  ],
  topDebtors: [
    { studentId: "s1", name: "Amanda Lopes", phone: "(11) 98888-7777", total: 27000, count: 2 },
  ],
  activeStudents: 32,
  attendance: {
    days: 30,
    classes: [
      { classId: "c1", classTypeName: "Jiu-Jitsu", dayOfWeek: 1, startTime: "19:00", endTime: "20:00", total: 10, present: 8, rate: 80 },
      { classId: "c2", classTypeName: "Muay Thai", dayOfWeek: 3, startTime: "18:00", endTime: "19:00", total: 0, present: 0, rate: null },
    ],
  },
};

describe("formatMonthLabel", () => {
  it("usa o mesmo rótulo dos gráficos da tela", () => {
    expect(formatMonthLabel("2026-07")).toBe("jul/26");
    expect(formatMonthLabel("2025-12")).toBe("dez/25");
  });
});

describe("buildReportsWorkbook", () => {
  const wb = buildReportsWorkbook(overview, "Anjo", new Date(2026, 6, 13, 10, 30));

  it("cria uma aba por seção da tela", () => {
    expect(wb.worksheets.map(ws => ws.name)).toEqual([
      "Resumo", "Faturamento", "Crescimento", "Inadimplência", "Frequência",
    ]);
  });

  it("Resumo traz os KPIs com moeda como número (centavos ÷ 100)", () => {
    const ws = wb.getWorksheet("Resumo")!;
    expect(ws.getCell("A1").value).toBe("Relatórios — Anjo");
    expect(ws.getCell("A2").value).toBe("Período: últimos 6 meses (jun/26 a jul/26)");
    // Receita = 10050 + 20000 centavos
    expect(ws.getCell("B6").value).toBeCloseTo(300.5);
    expect(ws.getCell("B6").numFmt).toBe('"R$" #,##0.00');
    // Saldo = 3 novos − 1 cancelado
    expect(ws.getCell("B11").value).toBe(2);
  });

  it("Faturamento lista os meses e fecha com total", () => {
    const ws = wb.getWorksheet("Faturamento")!;
    expect(ws.getCell("A2").value).toBe("jun/26");
    expect(ws.getCell("B2").value).toBeCloseTo(100.5);
    expect(ws.getCell("A4").value).toBe("Total");
    expect(ws.getCell("B4").value).toBeCloseTo(300.5);
  });

  it("Inadimplência traz a série mensal e os maiores devedores", () => {
    const ws = wb.getWorksheet("Inadimplência")!;
    expect(ws.getCell("B3").value).toBe(0);
    expect(ws.getCell("B4").value).toBeCloseTo(140);
    expect(ws.getCell("C4").value).toBe(3);
    // Bloco de devedores após a série (linha em branco + título + header)
    expect(ws.getCell("A7").value).toContain("Maiores devedores");
    expect(ws.getCell("A9").value).toBe("Amanda Lopes");
    expect(ws.getCell("B9").value).toBe(2);
    expect(ws.getCell("C9").value).toBeCloseTo(270);
  });

  it("Frequência formata taxa como percentual e marca turma sem chamadas", () => {
    const ws = wb.getWorksheet("Frequência")!;
    expect(ws.getCell("A3").value).toBe("Jiu-Jitsu");
    expect(ws.getCell("B3").value).toBe("Segunda");
    expect(ws.getCell("G3").value).toBeCloseTo(0.8);
    expect(ws.getCell("G3").numFmt).toBe("0%");
    expect(ws.getCell("G4").value).toBe("Sem chamadas");
  });
});
