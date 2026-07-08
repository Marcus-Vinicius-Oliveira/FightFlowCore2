/**
 * Formatação de datas de semântica date-only (vencimento, data de pagamento).
 *
 * O banco guarda essas datas de duas formas: formulários enviam "YYYY-MM-DD",
 * que vira meia-noite UTC; a cobrança recorrente grava meio-dia local. Formatar
 * no fuso do browser (UTC-3) desloca as de meia-noite UTC um dia para trás
 * ("pago em 06/07" vira "05/07"). Formatar em UTC acerta as duas famílias:
 * meia-noite UTC é o próprio dia, e meio-dia local (15:00 UTC) também.
 */

/** "2026-07-06T00:00:00Z" → "06/07/2026" (sem deslocar o dia) */
export function formatDateOnly(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/** "2026-07-06T00:00:00Z" → "julho de 2026" (sem deslocar o mês na virada) */
export function formatMonthYear(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Chave de mês para agrupamento/filtro (ex.: "2026-07"), pelas partes UTC */
export function monthKeyOf(value: string | number | Date): string {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "2026-07" → "julho de 2026" (minúsculo, para meio de frase) */
export function monthLabelOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  // Constrói a partir das partes — sem parse de string, sem deslocamento
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-07" → "Julho de 2026" — só a inicial; CSS capitalize daria "Julho De 2026" */
export function monthLabelCapOf(key: string): string {
  const label = monthLabelOf(key);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
