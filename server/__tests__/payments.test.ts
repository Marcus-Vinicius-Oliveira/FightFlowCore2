import { describe, it, expect } from 'vitest';
import { overdueCutoff } from '../lib/payments';

describe('overdueCutoff — vencimento só vira atraso após o fim do dia', () => {
  it('retorna o início do dia corrente', () => {
    const now = new Date(2026, 6, 3, 15, 42, 10); // 03/07/2026 15:42
    const cutoff = overdueCutoff(now);
    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(6);
    expect(cutoff.getDate()).toBe(3);
    expect(cutoff.getHours()).toBe(0);
    expect(cutoff.getMinutes()).toBe(0);
    expect(cutoff.getSeconds()).toBe(0);
    expect(cutoff.getMilliseconds()).toBe(0);
  });

  it('pagamento vencendo hoje NÃO é atrasado (dueDate >= cutoff)', () => {
    const now = new Date(2026, 6, 3, 15, 0, 0);
    const dueToday = new Date(2026, 6, 3, 0, 0, 0);
    expect(dueToday < overdueCutoff(now)).toBe(false);
  });

  it('pagamento vencido ontem É atrasado (dueDate < cutoff)', () => {
    const now = new Date(2026, 6, 3, 0, 0, 1); // primeiro segundo do dia seguinte
    const dueYesterday = new Date(2026, 6, 2, 23, 59, 59);
    expect(dueYesterday < overdueCutoff(now)).toBe(true);
  });
});
