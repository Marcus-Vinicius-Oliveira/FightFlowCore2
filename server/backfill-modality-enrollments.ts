// Backfill: garante que todo aluno com matrícula ativa em turma tenha o vínculo
// de modalidade correspondente (student_modality_enrollments) e uma graduação
// inicial se ainda não tiver rank na modalidade.
// Complementa a regra aplicada em runtime por ensureModalityEnrollment.
// Seguro para executar múltiplas vezes.
//
// Uso: tsx --env-file=.env server/backfill-modality-enrollments.ts

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { sql } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function main() {
  console.log('🔍 Backfill de vínculos de modalidade a partir das matrículas em turma...\n');

  // 1. Cria (ou reativa) o vínculo de modalidade para cada par (aluno, modalidade)
  //    derivado das matrículas ativas em turma.
  const enrollmentsResult = await db.execute(sql`
    INSERT INTO student_modality_enrollments (student_id, academy_id, class_type_id, enrolled_at, active)
    SELECT e.student_id, c.academy_id, c.class_type_id, MIN(e.start_date), true
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    WHERE e.active = true
    GROUP BY e.student_id, c.academy_id, c.class_type_id
    ON CONFLICT (student_id, class_type_id)
    DO UPDATE SET active = true, updated_at = now()
    WHERE student_modality_enrollments.active = false
    RETURNING student_id, class_type_id
  `);
  console.log(`✅ Vínculos de modalidade criados/reativados: ${enrollmentsResult.rows.length}`);

  // 2. Atribui a primeira graduação da modalidade a quem tem vínculo ativo mas
  //    nenhum rank nela (mesma regra do ensureModalityEnrollment). O promoted_by
  //    é o admin mais antigo da academia.
  const ranksResult = await db.execute(sql`
    INSERT INTO student_modality_ranks (student_id, academy_id, class_type_id, rank_id, promoted_at, promoted_by)
    SELECT sme.student_id, sme.academy_id, sme.class_type_id, fr.rank_id, now(), adm.id
    FROM student_modality_enrollments sme
    JOIN LATERAL (
      SELECT gr.id AS rank_id
      FROM graduation_systems gs
      JOIN graduation_ranks gr ON gr.system_id = gs.id
      WHERE gs.academy_id = sme.academy_id AND gs.class_type_id = sme.class_type_id
      ORDER BY gr.display_order ASC
      LIMIT 1
    ) fr ON true
    JOIN LATERAL (
      SELECT u.id
      FROM users u
      WHERE u.academy_id = sme.academy_id AND u.role = 'ADMIN_ACADEMIA'
      ORDER BY u.created_at ASC
      LIMIT 1
    ) adm ON true
    WHERE sme.active = true
      AND NOT EXISTS (
        SELECT 1 FROM student_modality_ranks smr
        WHERE smr.student_id = sme.student_id AND smr.class_type_id = sme.class_type_id
      )
    ON CONFLICT (student_id, class_type_id) DO NOTHING
    RETURNING student_id, academy_id, class_type_id, rank_id, promoted_by
  `);
  console.log(`✅ Graduações iniciais atribuídas: ${ranksResult.rows.length}`);

  // 3. Registra as graduações iniciais no histórico.
  for (const row of ranksResult.rows) {
    await db.execute(sql`
      INSERT INTO student_rank_history (student_id, academy_id, class_type_id, rank_before_id, rank_after_id, promoted_by, promoted_at, notes)
      VALUES (${row.student_id}::uuid, ${row.academy_id}::uuid, ${row.class_type_id}::uuid, NULL, ${row.rank_id}::uuid, ${row.promoted_by}::uuid, now(), 'Graduação inicial (backfill)')
    `);
  }
  if (ranksResult.rows.length > 0) {
    console.log(`✅ Entradas de histórico criadas: ${ranksResult.rows.length}`);
  }

  console.log('\n🏁 Backfill concluído.');
}

main()
  .catch(err => {
    console.error('❌ Erro no backfill:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
