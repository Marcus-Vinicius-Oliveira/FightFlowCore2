/**
 * Retenção/churn: classifica alunos ativos pelo tempo desde a última presença.
 *
 * Regras:
 * - Baseline = última presença (status 'presente'); aluno que nunca veio usa a
 *   data de cadastro (aluno novo sem presença não é "em risco" no dia 1).
 * - Buckets: 'risk' (≥ RETENTION_RISK_DAYS), 'attention' (≥ RETENTION_ATTENTION_DAYS),
 *   'ok' (abaixo disso).
 */

export const RETENTION_ATTENTION_DAYS = 14;
export const RETENTION_RISK_DAYS = 30;

export type RetentionBucket = 'risk' | 'attention' | 'ok';

export interface RetentionRow {
  id: string;
  name: string;
  createdAt: Date | string | null;
  lastPresenceAt: Date | string | null;
}

export interface RetentionEntry {
  id: string;
  name: string;
  /** Dias corridos desde a última presença (ou desde o cadastro, se nunca veio) */
  daysSinceLastSeen: number;
  neverAttended: boolean;
  bucket: RetentionBucket;
}

export interface RetentionReport {
  entries: RetentionEntry[];
  counts: Record<RetentionBucket, number>;
}

/** Dias corridos completos entre duas datas (nunca negativo). */
export function daysBetween(from: Date, now: Date): number {
  const diff = now.getTime() - from.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function bucketOf(daysSinceLastSeen: number): RetentionBucket {
  if (daysSinceLastSeen >= RETENTION_RISK_DAYS) return 'risk';
  if (daysSinceLastSeen >= RETENTION_ATTENTION_DAYS) return 'attention';
  return 'ok';
}

/**
 * Classifica os alunos e ordena por mais tempo sem aparecer (piores primeiro).
 * `entries` traz TODOS os alunos classificados; quem consome filtra por bucket.
 */
export function classifyRetention(rows: RetentionRow[], now: Date = new Date()): RetentionReport {
  const entries: RetentionEntry[] = rows.map(row => {
    const lastPresence = row.lastPresenceAt ? new Date(row.lastPresenceAt) : null;
    const baseline = lastPresence ?? (row.createdAt ? new Date(row.createdAt) : now);
    const daysSinceLastSeen = daysBetween(baseline, now);
    return {
      id: row.id,
      name: row.name,
      daysSinceLastSeen,
      neverAttended: !lastPresence,
      bucket: bucketOf(daysSinceLastSeen),
    };
  });

  entries.sort((a, b) =>
    b.daysSinceLastSeen - a.daysSinceLastSeen || a.name.localeCompare(b.name, 'pt-BR')
  );

  const counts: Record<RetentionBucket, number> = { risk: 0, attention: 0, ok: 0 };
  for (const e of entries) counts[e.bucket]++;

  return { entries, counts };
}
