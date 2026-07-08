import { describe, it, expect } from 'vitest';
import {
  classifyRetention,
  daysBetween,
  bucketOf,
  RETENTION_ATTENTION_DAYS,
  RETENTION_RISK_DAYS,
} from '../lib/retention';

const NOW = new Date('2026-07-07T15:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('daysBetween', () => {
  it('conta dias corridos completos', () => {
    expect(daysBetween(daysAgo(14), NOW)).toBe(14);
  });

  it('arredonda para baixo (13 dias e meio = 13)', () => {
    expect(daysBetween(new Date(NOW.getTime() - 13.5 * 86_400_000), NOW)).toBe(13);
  });

  it('nunca é negativo (data futura, ex.: cadastro com relógio adiantado)', () => {
    expect(daysBetween(daysAgo(-2), NOW)).toBe(0);
  });
});

describe('bucketOf', () => {
  it('limiares exatos: 14 = attention, 30 = risk', () => {
    expect(bucketOf(RETENTION_ATTENTION_DAYS - 1)).toBe('ok');
    expect(bucketOf(RETENTION_ATTENTION_DAYS)).toBe('attention');
    expect(bucketOf(RETENTION_RISK_DAYS - 1)).toBe('attention');
    expect(bucketOf(RETENTION_RISK_DAYS)).toBe('risk');
  });
});

describe('classifyRetention', () => {
  it('classifica pela última presença', () => {
    const { entries, counts } = classifyRetention([
      { id: '1', name: 'Ana', createdAt: daysAgo(300), lastPresenceAt: daysAgo(3) },
      { id: '2', name: 'Beto', createdAt: daysAgo(300), lastPresenceAt: daysAgo(20) },
      { id: '3', name: 'Caio', createdAt: daysAgo(300), lastPresenceAt: daysAgo(45) },
    ], NOW);

    expect(counts).toEqual({ ok: 1, attention: 1, risk: 1 });
    expect(entries.map(e => e.id)).toEqual(['3', '2', '1']); // piores primeiro
    expect(entries[0]).toMatchObject({ bucket: 'risk', daysSinceLastSeen: 45, neverAttended: false });
  });

  it('quem nunca veio usa a data de cadastro como baseline', () => {
    const { entries } = classifyRetention([
      { id: 'novo', name: 'Novato', createdAt: daysAgo(2), lastPresenceAt: null },
      { id: 'sumido', name: 'Sumido', createdAt: daysAgo(40), lastPresenceAt: null },
    ], NOW);

    const novo = entries.find(e => e.id === 'novo')!;
    const sumido = entries.find(e => e.id === 'sumido')!;
    expect(novo).toMatchObject({ bucket: 'ok', daysSinceLastSeen: 2, neverAttended: true });
    expect(sumido).toMatchObject({ bucket: 'risk', daysSinceLastSeen: 40, neverAttended: true });
  });

  it('aceita datas como string (formato do driver SQL)', () => {
    const { entries } = classifyRetention([
      { id: '1', name: 'Ana', createdAt: '2026-01-01T12:00:00Z', lastPresenceAt: '2026-06-20T19:00:00.000Z' },
    ], NOW);
    expect(entries[0].bucket).toBe('attention'); // 20/06 19h → 07/07 15h = 16 dias completos
    expect(entries[0].daysSinceLastSeen).toBe(16);
  });

  it('empate em dias ordena por nome pt-BR', () => {
    const { entries } = classifyRetention([
      { id: 'b', name: 'Érica', createdAt: null, lastPresenceAt: daysAgo(20) },
      { id: 'a', name: 'Eduardo', createdAt: null, lastPresenceAt: daysAgo(20) },
    ], NOW);
    expect(entries.map(e => e.name)).toEqual(['Eduardo', 'Érica']);
  });

  it('lista vazia devolve relatório zerado', () => {
    expect(classifyRetention([], NOW)).toEqual({ entries: [], counts: { risk: 0, attention: 0, ok: 0 } });
  });
});
