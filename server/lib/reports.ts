/**
 * Séries mensais dos relatórios. As agregações SQL devolvem apenas os meses
 * com dados; aqui a série é completada com zeros para que o gráfico mostre
 * o mês vazio em vez de pular — mesma filosofia do bucketAttendance.
 */

/** Chave YYYY-MM no fuso local (mesmo formato do TO_CHAR das queries). */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Primeiro dia do mês mais antigo de uma janela de `months` meses terminando em `reference`. */
export function monthsWindowStart(reference: Date, months: number): Date {
  return new Date(reference.getFullYear(), reference.getMonth() - (months - 1), 1, 0, 0, 0, 0);
}

/** Chaves dos últimos `months` meses, do mais antigo ao atual (inclusive). */
export function lastMonthKeys(reference: Date, months: number): string[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(reference.getFullYear(), reference.getMonth() - i, 1)));
  }
  return keys;
}

/**
 * Completa a série: para cada chave, usa a linha agregada correspondente ou
 * o valor zero. Linhas fora da janela (não deveriam existir) são ignoradas.
 */
export function fillMonthlySeries<R extends object>(
  keys: string[],
  rows: Array<{ month: string } & R>,
  zero: R,
): Array<{ month: string } & R> {
  const byMonth = new Map(rows.map(r => [r.month, r]));
  return keys.map(month => byMonth.get(month) ?? { month, ...zero });
}
