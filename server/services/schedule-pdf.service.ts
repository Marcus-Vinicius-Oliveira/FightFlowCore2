import type { ClassWithRefs } from '@shared/schema';

// ─── Paleta de cores por modalidade ───────────────────────────────────────────

interface ColorScheme { bg: string; border: string; text: string }

// ── Paleta Corporativa Premium — fundo branco, bordas com cor forte ──────────
const COLOR_RULES: { pattern: RegExp; c: ColorScheme }[] = [
  { pattern: /bjj|jiu.?jitsu/i,         c: { bg: '#eff6ff', border: '#2563eb', text: '#1e40af' } },
  { pattern: /muay.?thai/i,             c: { bg: '#fef2f2', border: '#dc2626', text: '#991b1b' } },
  { pattern: /box(e|ing)/i,             c: { bg: '#fffbeb', border: '#d97706', text: '#92400e' } },
  { pattern: /karat[eê]/i,              c: { bg: '#f5f3ff', border: '#7c3aed', text: '#5b21b6' } },
  { pattern: /jud[oô]/i,               c: { bg: '#f0fdf4', border: '#16a34a', text: '#14532d' } },
  { pattern: /kick/i,                   c: { bg: '#fff7ed', border: '#ea580c', text: '#9a3412' } },
  { pattern: /luta.?livre|wrestling/i,  c: { bg: '#fdf4ff', border: '#9333ea', text: '#6b21a8' } },
  { pattern: /taekwondo|tkd/i,          c: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' } },
  { pattern: /kung.?fu|wushu/i,         c: { bg: '#ecfdf5', border: '#059669', text: '#065f46' } },
];

const FALLBACK: ColorScheme[] = [
  { bg: '#f0f9ff', border: '#0284c7', text: '#075985' },
  { bg: '#fdf4ff', border: '#a21caf', text: '#701a75' },
  { bg: '#f0fdf4', border: '#15803d', text: '#14532d' },
  { bg: '#fff1f2', border: '#e11d48', text: '#9f1239' },
  { bg: '#f8fafc', border: '#475569', text: '#1e293b' },
  { bg: '#fefce8', border: '#ca8a04', text: '#713f12' },
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
@page { size: A4 landscape; margin: 12mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif;
  color: #1e293b;
  background: #ffffff;
  font-size: 11px;
}

/* ── Header ─────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
  border-radius: 6px;
  padding: 14px 18px;
  margin-bottom: 16px;
}
.h-left   { display: flex; align-items: center; gap: 14px; }
.logo     { font-size: 28px; line-height: 1; }
.title    {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.subtitle {
  font-size: 8.5px;
  color: #94a3b8;
  margin-top: 3px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.meta { text-align: right; font-size: 8.5px; color: #94a3b8; line-height: 2; }
.meta-highlight { color: #cbd5e1; font-weight: 600; }

/* ── Table ──────────────────────────────────── */
table { width: 100%; border-collapse: collapse; table-layout: fixed; }

thead tr {
  background: #f1f5f9;
  border-top: 2px solid #1e40af;
  border-bottom: 1px solid #e2e8f0;
}
thead th {
  color: #475569;
  padding: 9px 6px;
  font-size: 8.5px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
thead th:first-child { text-align: left; padding-left: 12px; width: 110px; color: #64748b; }

tbody tr { border-bottom: 1px solid #f1f5f9; }
tbody tr:nth-child(even) { background: #fafafa; }

td { padding: 7px 5px; vertical-align: top; }
td.time {
  font-size: 9.5px;
  font-weight: 700;
  color: #334155;
  padding-left: 12px;
  white-space: nowrap;
  letter-spacing: 0.3px;
  padding-top: 10px;
}
td.empty {
  text-align: center;
  color: #cbd5e1;
  font-size: 14px;
}

/* ── Cards ──────────────────────────────────── */
.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 4px;
  border-left: 3px solid;
  padding: 6px 8px;
  margin-bottom: 4px;
  min-height: 36px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.card:last-child { margin-bottom: 0; }
.card-name {
  display: block;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.card-inst {
  display: block;
  font-size: 8px;
  opacity: 0.7;
  margin-top: 2px;
  letter-spacing: 0.2px;
}

/* ── Misc ───────────────────────────────────── */
.footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
  font-size: 7.5px;
  color: #94a3b8;
  text-align: center;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.no-data {
  padding: 48px;
  text-align: center;
  color: #cbd5e1;
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
      <div>${dateStr}</div>
      <div><span class="meta-highlight">${slots.length}</span> horário${slots.length !== 1 ? 's' : ''} &nbsp;·&nbsp; <span class="meta-highlight">${activeDays.length}</span> dia${activeDays.length !== 1 ? 's' : ''} ativo${activeDays.length !== 1 ? 's' : ''}</div>
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
