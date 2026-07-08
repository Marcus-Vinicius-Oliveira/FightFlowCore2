import { describe, it, expect } from 'vitest';
import {
  suggestGraduations,
  GRADUATION_MIN_DAYS_IN_RANK,
  GRADUATION_MIN_PRESENCES,
  type GraduationCandidateRow,
} from '../lib/graduation-suggestion';

const NOW = new Date('2026-07-07T15:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function row(overrides: Partial<GraduationCandidateRow>): GraduationCandidateRow {
  return {
    studentId: 's1',
    studentName: 'Aluno',
    classTypeId: 'ct1',
    classTypeName: 'BJJ',
    rankName: 'Branca',
    rankColor: '#f8fafc',
    nextRankName: 'Azul',
    promotedAt: daysAgo(100),
    presencesSincePromotion: 25,
    ...overrides,
  };
}

describe('suggestGraduations', () => {
  it('sugere quem cumpre tempo E presenças', () => {
    const [s] = suggestGraduations([row({})], NOW);
    expect(s).toMatchObject({
      rankName: 'Branca',
      nextRankName: 'Azul',
      daysInRank: 100,
      presencesSincePromotion: 25,
    });
  });

  it('não sugere quem está há pouco tempo na faixa, mesmo com muitas presenças', () => {
    expect(suggestGraduations([
      row({ promotedAt: daysAgo(GRADUATION_MIN_DAYS_IN_RANK - 1), presencesSincePromotion: 99 }),
    ], NOW)).toEqual([]);
  });

  it('não sugere quem tem poucas presenças, mesmo com muito tempo de faixa', () => {
    expect(suggestGraduations([
      row({ promotedAt: daysAgo(400), presencesSincePromotion: GRADUATION_MIN_PRESENCES - 1 }),
    ], NOW)).toEqual([]);
  });

  it('limiares exatos contam (90 dias e 20 presenças)', () => {
    const out = suggestGraduations([
      row({ promotedAt: daysAgo(GRADUATION_MIN_DAYS_IN_RANK), presencesSincePromotion: GRADUATION_MIN_PRESENCES }),
    ], NOW);
    expect(out).toHaveLength(1);
  });

  it('quem está na última faixa do sistema não é candidato', () => {
    expect(suggestGraduations([row({ nextRankName: null })], NOW)).toEqual([]);
  });

  it('sem data de promoção não há como medir tempo — fora', () => {
    expect(suggestGraduations([row({ promotedAt: null })], NOW)).toEqual([]);
  });

  it('ordena por prontidão: presenças, depois tempo de faixa, depois nome', () => {
    const out = suggestGraduations([
      row({ studentId: 'a', studentName: 'Zico', presencesSincePromotion: 30, promotedAt: daysAgo(100) }),
      row({ studentId: 'b', studentName: 'Ana', presencesSincePromotion: 40, promotedAt: daysAgo(95) }),
      row({ studentId: 'c', studentName: 'Beto', presencesSincePromotion: 30, promotedAt: daysAgo(200) }),
    ], NOW);
    expect(out.map(s => s.studentId)).toEqual(['b', 'c', 'a']);
  });

  it('aceita promotedAt como string (formato do driver SQL)', () => {
    const out = suggestGraduations([row({ promotedAt: '2026-01-01T12:00:00.000Z' })], NOW);
    expect(out).toHaveLength(1);
    expect(out[0].daysInRank).toBeGreaterThan(180);
  });
});
