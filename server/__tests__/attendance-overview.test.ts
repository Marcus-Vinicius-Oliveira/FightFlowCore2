import { describe, it, expect, vi } from 'vitest';

// Mock router-level dependencies so we can import the module without a real DB
vi.mock('../db', () => ({ db: {} }));
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../auth', () => ({
  authenticateToken: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireSameAcademy: vi.fn(),
}));

import { bucketAttendance } from '../routes/dashboard.routes';

const rec = (iso: string, status = 'presente') => ({ date: new Date(iso), status });

describe('bucketAttendance', () => {
  const start = new Date('2026-06-08T00:00:00'); // segunda-feira
  const end = new Date('2026-07-08T00:00:00');   // 30 dias depois

  it('30 dias em baldes semanais → 5 baldes contíguos (último parcial)', () => {
    const buckets = bucketAttendance([], start, end, 'week');
    expect(buckets).toHaveLength(5);
    expect(buckets[0].start).toBe('2026-06-08');
    expect(buckets[1].start).toBe('2026-06-15');
    expect(buckets[4].start).toBe('2026-07-06');
  });

  it('7 dias em baldes diários → 7 baldes', () => {
    const weekEnd = new Date('2026-06-15T00:00:00');
    expect(bucketAttendance([], start, weekEnd, 'day')).toHaveLength(7);
  });

  it('distribui registros no balde certo e calcula a taxa', () => {
    const buckets = bucketAttendance(
      [
        rec('2026-06-09T19:00:00'),           // semana 1, presente
        rec('2026-06-10T19:00:00', 'falta'),  // semana 1, falta
        rec('2026-06-16T19:00:00'),           // semana 2, presente
      ],
      start, end, 'week',
    );
    expect(buckets[0]).toMatchObject({ total: 2, present: 1, rate: 50 });
    expect(buckets[1]).toMatchObject({ total: 1, present: 1, rate: 100 });
  });

  it('balde sem registros fica com rate null (sem chamada ≠ 0% de presença)', () => {
    const buckets = bucketAttendance([rec('2026-06-09T19:00:00')], start, end, 'week');
    expect(buckets[2]).toMatchObject({ total: 0, present: 0, rate: null });
  });

  it('registro fora do intervalo é ignorado', () => {
    const buckets = bucketAttendance([rec('2026-05-01T19:00:00')], start, end, 'week');
    expect(buckets.every(b => b.total === 0)).toBe(true);
  });

  it("'justificado' conta no total mas não como presença", () => {
    const buckets = bucketAttendance([rec('2026-06-09T19:00:00', 'justificado')], start, end, 'week');
    expect(buckets[0]).toMatchObject({ total: 1, present: 0, rate: 0 });
  });
});
