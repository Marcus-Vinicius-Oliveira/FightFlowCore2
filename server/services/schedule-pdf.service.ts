import type { ClassWithRefs } from '@shared/schema';

// ─── Paleta de cores por modalidade ───────────────────────────────────────────

interface ColorScheme { bg: string; border: string; text: string }

// ── Paleta Combat Dark — fundos escuros + bordas/texto neon ──────────────────
const COLOR_RULES: { pattern: RegExp; c: ColorScheme }[] = [
  { pattern: /bjj|jiu.?jitsu/i,         c: { bg: '#172554', border: '#3b82f6', text: '#93c5fd' } },
  { pattern: /muay.?thai/i,             c: { bg: '#450a0a', border: '#ef4444', text: '#fca5a5' } },
  { pattern: /box(e|ing)/i,             c: { bg: '#451a03', border: '#f59e0b', text: '#fcd34d' } },
  { pattern: /karat[eê]/i,              c: { bg: '#2e1065', border: '#a855f7', text: '#d8b4fe' } },
  { pattern: /jud[oô]/i,               c: { bg: '#2e1065', border: '#a855f7', text: '#d8b4fe' } },
  { pattern: /kick/i,                   c: { bg: '#431407', border: '#f97316', text: '#fdba74' } },
  { pattern: /luta.?livre|wrestling/i,  c: { bg: '#4a044e', border: '#e879f9', text: '#f0abfc' } },
  { pattern: /taekwondo|tkd/i,          c: { bg: '#431407', border: '#f97316', text: '#fdba74' } },
  { pattern: /kung.?fu|wushu/i,         c: { bg: '#052e16', border: '#22c55e', text: '#86efac' } },
];

const FALLBACK: ColorScheme[] = [
  { bg: '#0c1a2e', border: '#38bdf8', text: '#7dd3fc' },
  { bg: '#1a0a2e', border: '#c084fc', text: '#e9d5ff' },
  { bg: '#052e16', border: '#4ade80', text: '#bbf7d0' },
  { bg: '#3b0a0a', border: '#f87171', text: '#fecaca' },
  { bg: '#1c1917', border: '#a8a29e', text: '#d6d3d1' },
  { bg: '#1a1a03', border: '#facc15', text: '#fef08a' },
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
@page { size: A4 landscape; margin: 10mm 12mm; background: #09090b; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', Helvetica Neue, Arial, sans-serif;
  color: #f4f4f5;
  background: #09090b;
  font-size: 11px;
}

/* ── Header ─────────────────────────────────── */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #3f3f46;
  padding-bottom: 12px;
  margin-bottom: 14px;
}
.h-left   { display: flex; align-items: center; gap: 12px; }
.logo     { font-size: 30px; line-height: 1; }
.title    {
  font-size: 20px;
  font-weight: 900;
  color: #ffffff;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.subtitle {
  font-size: 9px;
  color: #71717a;
  margin-top: 3px;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.meta { text-align: right; font-size: 9px; color: #52525b; line-height: 1.8; }

/* ── Table ──────────────────────────────────── */
table { width: 100%; border-collapse: collapse; table-layout: fixed; }

thead tr { background: #18181b; border-bottom: 1px solid #3f3f46; }
thead th {
  color: #a1a1aa;
  padding: 9px 5px;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
thead th:first-child { text-align: left; padding-left: 10px; width: 108px; color: #71717a; }

tbody tr { border-bottom: 1px solid #27272a; }
tbody tr:nth-child(even) { background: #111113; }

td { padding: 6px 4px; vertical-align: middle; }
td.time {
  font-size: 10px;
  font-weight: 700;
  color: #a1a1aa;
  padding-left: 10px;
  white-space: nowrap;
  letter-spacing: 0.5px;
}
td.empty {
  text-align: center;
  color: #3f3f46;
  font-size: 16px;
  letter-spacing: 2px;
}

/* ── Cards ──────────────────────────────────── */
.card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 3px;
  padding: 5px 8px;
  margin-bottom: 3px;
  min-height: 34px;
}
.card:last-child { margin-bottom: 0; }
.card-name {
  display: block;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.3;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.card-inst {
  display: block;
  font-size: 8.5px;
  opacity: 0.6;
  margin-top: 2px;
  letter-spacing: 0.3px;
}

/* ── Misc ───────────────────────────────────── */
.footer {
  margin-top: 12px;
  font-size: 8px;
  color: #3f3f46;
  text-align: center;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.no-data {
  padding: 40px;
  text-align: center;
  color: #3f3f46;
  font-size: 13px;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { background: #09090b; }
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
      <div>${slots.length} horário${slots.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${activeDays.length} dia${activeDays.length !== 1 ? 's' : ''} ativo${activeDays.length !== 1 ? 's' : ''}</div>
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
