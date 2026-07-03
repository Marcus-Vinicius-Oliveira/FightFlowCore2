/**
 * Convenção brasileira: a mensalidade que vence hoje só passa a "atrasada"
 * depois que o dia do vencimento termina. O corte é o início do dia corrente —
 * tudo com dueDate anterior a ele está vencido.
 */
export function overdueCutoff(now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}
