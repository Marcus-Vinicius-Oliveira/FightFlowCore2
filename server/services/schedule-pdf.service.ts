import type { ClassWithRefs } from '@shared/schema';

// ─── Paleta de cores por modalidade ───────────────────────────────────────────

interface ColorScheme { bg: string; border: string; text: string }

const COLOR_RULES: { pattern: RegExp; c: ColorScheme }[] = [
  { pattern: /bjj|jiu.?jitsu/i,         c: { bg: '#DBEAFE', border: '#2563EB', text: '#1E40AF' } },
  { pattern: /muay.?thai/i,             c: { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' } },
  { pattern: /box(e|ing)/i,             c: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' } },
  { pattern: /karat[eê]/i,              c: { bg: '#EDE9FE', border: '#7C3AED', text: '#5B21B6' } },
  { pattern: /jud[oô]/i,               c: { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' } },
  { pattern: /kick/i,                   c: { bg: '#FFEDD5', border: '#EA580C', text: '#9A3412' } },
  { pattern: /luta.?livre|wrestling/i,  c: { bg: '#FCE7F3', border: '#DB2777', text: '#9D174D' } },
  { pattern: /taekwondo|tkd/i,          c: { bg: '#FFF7ED', border: '#F97316', text: '#C2410C' } },
  { pattern: /kung.?fu|wushu/i,         c: { bg: '#ECFDF5', border: '#10B981', text: '#064E3B' } },
];

const FALLBACK: ColorScheme[] = [
  { bg: '#F0F9FF', border: '#0284C7', text: '#075985' },
  { bg: '#FDF4FF', border: '#A21CAF', text: '#701A75' },
  { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
  { bg: '#FFF1F2', border: '#E11D48', text: '#9F1239' },
  { bg: '#F5F3FF', border: '#7C3AED', text: '#4C1D95' },
  { bg: '#FFFBEB', border: '#D97706', text: '#92400E' },
];

function classColor(name: string): ColorScheme {
  return (
    COLOR_RULES.find(r => r.pattern.test(name))?.c ??
    FALLBACK[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % FALLBACK.length]
  );
}

// ─── Construção da Matriz Horária ─────────────────────────────────────────────

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Cell { typeName: string; instructorName: string; color: ColorScheme }

function buildMatrix(classes: ClassWithRefs[]) {
  // 1. Coletar slots únicos (startTime|endTime) e dias ativos
  const slotMap = new Map<string, string>(); // key → label "HH:MM – HH:MM"
  const daySet  = new Set<number>();

  for (const cls of classes) {
    const key = `${cls.startTime}|${cls.endTime}`;
    slotMap.set(key, `${cls.startTime} – ${cls.endTime}`);
    daySet.add(cls.dayOfWeek);
  }

  // 2. Ordenar slots por startTime (lexicográfico funciona para HH:MM)
  const slots = Array.from(slotMap.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const activeDays = Array.from(daySet).sort((a, b) => a - b);

  // 3. Inicializar matriz [slotKey][dayOfWeek] → Cell[]
  const matrix: Record<string, Record<number, Cell[]>> = {};
  for (const { key } of slots) {
    matrix[key] = {};
    for (const day of activeDays) matrix[key][day] = [];
  }

  // 4. Preencher — suporta múltiplas aulas no mesmo slot/dia (stacked cards)
  for (const cls of classes) {
    const key      = `${cls.startTime}|${cls.endTime}`;
    const typeName = cls.classType?.name ?? 'Aula';
    matrix[key][cls.dayOfWeek].push({
      typeName,
      instructorName: cls.instructor?.name ?? '—',
      color: classColor(typeName),
    });
  }

  return { slots, activeDays, matrix };
}

// ─── Template HTML ────────────────────────────────────────────────────────────

function buildHtml(academyName: string, classes: ClassWithRefs[]): string {
  const { slots, activeDays, matrix } = buildMatrix(classes);

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const dayHeaders = activeDays
    .map(d => `<th>${DAY_LABELS[d]}</th>`)
    .join('');

  const rows = slots.map(({ key, label }) => {
    const cells = activeDays.map(day => {
      const items = matrix[key][day];
      if (!items.length) return `<td class="empty">—</td>`;
      const cards = items.map(({ typeName, instructorName, color }) => `
        <div class="card" style="background:${color.bg};border-left:4px solid ${color.border};color:${color.text}">
          <span class="card-name">${typeName}</span>
          <span class="card-inst">${instructorName}</span>
        </div>`).join('');
      return `<td>${cards}</td>`;
    }).join('');

    return `<tr><td class="time">${label}</td>${cells}</tr>`;
  }).join('');

  const noData = slots.length === 0
    ? `<div class="no-data">Nenhuma aula cadastrada.</div>`
    : '';

  return /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', Helvetica Neue, Arial, sans-serif;
  color: #1e293b;
  background: #fff;
  font-size: 11px;
}

/* ── Header ─────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-bottom: 3px solid #1d4ed8;
  padding-bottom: 10px;
  margin-bottom: 14px;
}
.h-left   { display: flex; align-items: center; gap: 10px; }
.logo     { font-size: 28px; line-height: 1; }
.title    { font-size: 19px; font-weight: 700; color: #1e293b; letter-spacing: -0.4px; }
.subtitle { font-size: 10px; color: #64748b; margin-top: 2px; }
.meta     { text-align: right; font-size: 9.5px; color: #94a3b8; line-height: 1.7; }

/* ── Table ──────────────────────────────────── */
table { width: 100%; border-collapse: collapse; table-layout: fixed; }

thead tr { background: #1e3a5f; }
thead th {
  color: #e2e8f0;
  padding: 8px 5px;
  font-size: 10px;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}
thead th:first-child { text-align: left; padding-left: 10px; width: 108px; }

tbody tr { border-bottom: 1px solid #e2e8f0; }
tbody tr:nth-child(even) { background: #f8fafc; }

td { padding: 5px 4px; vertical-align: top; }
td.time {
  font-size: 10.5px;
  font-weight: 700;
  color: #334155;
  vertical-align: middle;
  padding-left: 10px;
  white-space: nowrap;
}
td.empty {
  text-align: center;
  vertical-align: middle;
  color: #cbd5e1;
  font-size: 14px;
}

/* ── Cards ──────────────────────────────────── */
.card {
  border-radius: 4px;
  padding: 4px 7px;
  margin-bottom: 3px;
}
.card:last-child { margin-bottom: 0; }
.card-name {
  display: block;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.3;
}
.card-inst {
  display: block;
  font-size: 8.5px;
  opacity: 0.75;
  margin-top: 1px;
}

/* ── Misc ───────────────────────────────────── */
.footer {
  margin-top: 10px;
  font-size: 8.5px;
  color: #94a3b8;
  text-align: center;
}
.no-data {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
  <div class="header">
    <div class="h-left">
      <span class="logo">🥋</span>
      <div>
        <div class="title">${academyName}</div>
        <div class="subtitle">Grade Horária Semanal</div>
      </div>
    </div>
    <div class="meta">
      <div>Gerado em ${dateStr}</div>
      <div>${slots.length} horário${slots.length !== 1 ? 's' : ''} &nbsp;•&nbsp; ${activeDays.length} dia${activeDays.length !== 1 ? 's' : ''} ativo${activeDays.length !== 1 ? 's' : ''}</div>
    </div>
  </div>

  ${noData}

  ${slots.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Horário</th>
        ${dayHeaders}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>` : ''}

  <div class="footer">
    Documento gerado automaticamente pelo sistema FightFlow &nbsp;•&nbsp; ${new Date().getFullYear()}
  </div>
</body>
</html>`;
}

// ─── Geração do PDF via Playwright ───────────────────────────────────────────

export async function generateSchedulePDF(
  academyName: string,
  classes: ClassWithRefs[],
): Promise<Buffer> {
  // Import dinâmico para não bloquear o startup do servidor
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(academyName, classes), { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      // Margens controladas pelo @page CSS
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
