/**
 * Monta a pasta de trabalho Excel dos relatórios gerenciais a partir do
 * payload de getReportsOverview — uma aba por seção da tela (Resumo,
 * Faturamento, Crescimento, Inadimplência, Frequência).
 *
 * Valores monetários saem como número (centavos ÷ 100) com formato de moeda,
 * nunca texto: o usuário precisa conseguir somar/filtrar na planilha.
 */
import ExcelJS from "exceljs";
import type { ReportsOverview } from "./reports-overview";

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const BRL_FMT = '"R$" #,##0.00';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

/** "2026-07" → "jul/26", mesmo rótulo dos gráficos da tela. */
export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]}/${y.slice(2)}`;
}

function addHeaderRow(ws: ExcelJS.Worksheet, labels: string[]) {
  const row = ws.addRow(labels);
  row.font = { bold: true };
  row.eachCell(cell => { cell.fill = HEADER_FILL; });
  return row;
}

export function buildReportsWorkbook(
  overview: ReportsOverview,
  academyName: string,
  now = new Date(),
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fight Club App';
  wb.created = now;

  const { monthly, topDebtors, activeStudents, attendance, months } = overview;
  const totals = monthly.reduce(
    (acc, p) => ({
      revenue: acc.revenue + p.revenue,
      overdue: acc.overdue + p.overdueAmount,
      newStudents: acc.newStudents + p.newStudents,
      cancellations: acc.cancellations + p.cancellations,
    }),
    { revenue: 0, overdue: 0, newStudents: 0, cancellations: 0 },
  );
  const periodLabel = monthly.length > 0
    ? `${formatMonthLabel(monthly[0].month)} a ${formatMonthLabel(monthly[monthly.length - 1].month)}`
    : '—';

  // ── Resumo ─────────────────────────────────────────────────────────────
  const resumo = wb.addWorksheet('Resumo');
  resumo.columns = [{ width: 38 }, { width: 20 }];
  const title = resumo.addRow([`Relatórios — ${academyName}`]);
  title.font = { bold: true, size: 14 };
  resumo.addRow([`Período: últimos ${months} meses (${periodLabel})`]);
  resumo.addRow([`Frequência: últimos ${attendance.days} dias`]);
  resumo.addRow([
    `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
  ]);
  resumo.addRow([]);
  const kpi = (label: string, value: number, isMoney = false) => {
    const row = resumo.addRow([label, isMoney ? value / 100 : value]);
    row.getCell(1).font = { bold: true };
    if (isMoney) row.getCell(2).numFmt = BRL_FMT;
  };
  kpi('Receita no período (pagamentos confirmados)', totals.revenue, true);
  kpi('Vencido sem pagamento (mensalidades do período)', totals.overdue, true);
  kpi('Alunos ativos hoje', activeStudents);
  kpi('Novos alunos no período', totals.newStudents);
  kpi('Cancelamentos no período', totals.cancellations);
  kpi('Saldo de alunos', totals.newStudents - totals.cancellations);

  // ── Faturamento ────────────────────────────────────────────────────────
  const fat = wb.addWorksheet('Faturamento');
  fat.columns = [{ width: 12 }, { width: 18 }];
  fat.views = [{ state: 'frozen', ySplit: 1 }];
  addHeaderRow(fat, ['Mês', 'Receita paga']);
  for (const p of monthly) {
    const row = fat.addRow([formatMonthLabel(p.month), p.revenue / 100]);
    row.getCell(2).numFmt = BRL_FMT;
  }
  const fatTotal = fat.addRow(['Total', totals.revenue / 100]);
  fatTotal.font = { bold: true };
  fatTotal.getCell(2).numFmt = BRL_FMT;

  // ── Crescimento ────────────────────────────────────────────────────────
  const cresc = wb.addWorksheet('Crescimento');
  cresc.columns = [{ width: 12 }, { width: 14 }, { width: 16 }, { width: 10 }];
  cresc.views = [{ state: 'frozen', ySplit: 1 }];
  addHeaderRow(cresc, ['Mês', 'Novos alunos', 'Cancelamentos', 'Saldo']);
  for (const p of monthly) {
    cresc.addRow([formatMonthLabel(p.month), p.newStudents, p.cancellations, p.newStudents - p.cancellations]);
  }
  const crescTotal = cresc.addRow(['Total', totals.newStudents, totals.cancellations, totals.newStudents - totals.cancellations]);
  crescTotal.font = { bold: true };
  cresc.addRow([]);
  cresc.addRow(['Cancelamentos são contabilizados a partir de julho/2026; desativações anteriores não aparecem.']);

  // ── Inadimplência ──────────────────────────────────────────────────────
  const inad = wb.addWorksheet('Inadimplência');
  inad.columns = [{ width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }];
  const inadTitle = inad.addRow(['Vencido em aberto por mês de vencimento']);
  inadTitle.font = { bold: true };
  addHeaderRow(inad, ['Mês', 'Valor vencido', 'Alunos devedores']);
  for (const p of monthly) {
    const row = inad.addRow([formatMonthLabel(p.month), p.overdueAmount / 100, p.overdueStudents]);
    row.getCell(2).numFmt = BRL_FMT;
  }
  const inadTotal = inad.addRow(['Total', totals.overdue / 100]);
  inadTotal.font = { bold: true };
  inadTotal.getCell(2).numFmt = BRL_FMT;

  inad.addRow([]);
  const devTitle = inad.addRow(['Maiores devedores (toda a dívida vencida em aberto, sem limite de período)']);
  devTitle.font = { bold: true };
  addHeaderRow(inad, ['Aluno', 'Mensalidades em aberto', 'Total devido', 'Telefone']);
  for (const d of topDebtors) {
    const row = inad.addRow([d.name, d.count, d.total / 100, d.phone ?? '—']);
    row.getCell(3).numFmt = BRL_FMT;
  }

  // ── Frequência ─────────────────────────────────────────────────────────
  const freq = wb.addWorksheet('Frequência');
  freq.columns = [{ width: 24 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 10 }];
  const freqTitle = freq.addRow([`Frequência por turma — últimos ${attendance.days} dias`]);
  freqTitle.font = { bold: true };
  addHeaderRow(freq, ['Modalidade', 'Dia', 'Início', 'Fim', 'Presenças', 'Registros', 'Taxa']);
  for (const c of attendance.classes) {
    const row = freq.addRow([
      c.classTypeName,
      DAY_NAMES[c.dayOfWeek],
      c.startTime,
      c.endTime,
      c.present,
      c.total,
      c.rate == null ? 'Sem chamadas' : c.rate / 100,
    ]);
    if (c.rate != null) row.getCell(7).numFmt = '0%';
  }

  return wb;
}
