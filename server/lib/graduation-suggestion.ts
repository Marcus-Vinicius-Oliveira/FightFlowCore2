/**
 * Sugestão de graduação: candidatos a promoção por modalidade, cruzando
 * presenças acumuladas desde a última promoção com o tempo na faixa atual.
 *
 * Critério (defaults transparentes, não configuráveis por enquanto):
 * - tempo na faixa ≥ GRADUATION_MIN_DAYS_IN_RANK dias, E
 * - presenças na modalidade desde a promoção ≥ GRADUATION_MIN_PRESENCES, E
 * - existe uma próxima faixa no sistema (quem está na última não é candidato).
 *
 * É sugestão, não automação: a decisão e o registro continuam com o professor.
 */

export const GRADUATION_MIN_DAYS_IN_RANK = 90;
export const GRADUATION_MIN_PRESENCES = 20;

export interface GraduationCandidateRow {
  studentId: string;
  studentName: string;
  classTypeId: string;
  classTypeName: string;
  rankName: string;
  /** cor da faixa atual (colorClass "hex" ou "hex|hex") */
  rankColor: string | null;
  nextRankName: string | null;
  promotedAt: Date | string | null;
  presencesSincePromotion: number;
}

export interface GraduationSuggestion {
  studentId: string;
  studentName: string;
  classTypeId: string;
  classTypeName: string;
  rankName: string;
  rankColor: string | null;
  nextRankName: string;
  daysInRank: number;
  presencesSincePromotion: number;
}

function daysBetween(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Filtra os candidatos que cumprem o critério e ordena por prontidão
 * (mais presenças primeiro; empate por mais tempo na faixa).
 */
export function suggestGraduations(
  rows: GraduationCandidateRow[],
  now: Date = new Date(),
): GraduationSuggestion[] {
  const suggestions: GraduationSuggestion[] = [];

  for (const row of rows) {
    if (!row.nextRankName) continue;      // já está na última faixa do sistema
    if (!row.promotedAt) continue;        // sem data de promoção não há como medir tempo
    const daysInRank = daysBetween(new Date(row.promotedAt), now);
    if (daysInRank < GRADUATION_MIN_DAYS_IN_RANK) continue;
    if (row.presencesSincePromotion < GRADUATION_MIN_PRESENCES) continue;

    suggestions.push({
      studentId: row.studentId,
      studentName: row.studentName,
      classTypeId: row.classTypeId,
      classTypeName: row.classTypeName,
      rankName: row.rankName,
      rankColor: row.rankColor,
      nextRankName: row.nextRankName,
      daysInRank,
      presencesSincePromotion: row.presencesSincePromotion,
    });
  }

  return suggestions.sort((a, b) =>
    b.presencesSincePromotion - a.presencesSincePromotion ||
    b.daysInRank - a.daysInRank ||
    a.studentName.localeCompare(b.studentName, 'pt-BR')
  );
}
