// Remove class_types e graduation_systems duplicados por NOME dentro da mesma academia.
// Mantém o class_type com mais sistemas/ranks associados e migra os demais para ele.
// Seguro para executar múltiplas vezes.

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { sql } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function main() {
  console.log('🔍 Verificando class_types duplicados por nome...\n');

  // Grupos de class_types com mesmo (academy_id, LOWER(name)) e mais de 1 entrada
  const dupeNames = await db.execute(sql`
    SELECT
      academy_id,
      LOWER(name) AS name_lower,
      COUNT(*)::int AS total,
      ARRAY_AGG(id ORDER BY
        (SELECT COUNT(*) FROM graduation_systems gs WHERE gs.class_type_id = ct.id) DESC,
        created_at ASC
      ) AS ids
    FROM class_types ct
    GROUP BY academy_id, LOWER(name)
    HAVING COUNT(*) > 1
  `);

  if (dupeNames.rows.length === 0) {
    console.log('✅ Nenhum class_type duplicado por nome encontrado.');
    return;
  }

  for (const row of dupeNames.rows) {
    const ids = row.ids as string[];
    const canonicalId = ids[0]; // o com mais sistemas/ranks, ou o mais antigo
    const duplicateIds = ids.slice(1);

    console.log(`⚠️  "${row.name_lower}": ${row.total} class_types com o mesmo nome.`);
    console.log(`   Canônico (mantido): ${canonicalId}`);
    console.log(`   Duplicados:         ${duplicateIds.join(', ')}`);

    for (const dupId of duplicateIds) {
      // 1. Migra graduation_systems do duplicado para o canônico
      //    (caso o canônico ainda não tenha sistema para essa academia)
      const [existingCanonicalSys] = (await db.execute(sql`
        SELECT id FROM graduation_systems
        WHERE academy_id = ${row.academy_id}::uuid AND class_type_id = ${canonicalId}::uuid
        LIMIT 1
      `)).rows;

      if (!existingCanonicalSys) {
        // Canônico não tem sistema → reassocia o do duplicado
        await db.execute(sql`
          UPDATE graduation_systems
          SET class_type_id = ${canonicalId}::uuid
          WHERE academy_id = ${row.academy_id}::uuid AND class_type_id = ${dupId}::uuid
        `);
        console.log(`   └─ graduation_system migrado para canônico`);
      } else {
        // Canônico já tem sistema → deleta o sistema do duplicado (com cascade nos ranks)
        await db.execute(sql`
          DELETE FROM graduation_systems
          WHERE academy_id = ${row.academy_id}::uuid AND class_type_id = ${dupId}::uuid
        `);
        console.log(`   └─ graduation_system duplicado removido`);
      }

      // 2. Migra demais referências do duplicado para o canônico
      await db.execute(sql`UPDATE classes SET class_type_id = ${canonicalId}::uuid WHERE class_type_id = ${dupId}::uuid`);
      await db.execute(sql`UPDATE student_modality_ranks SET class_type_id = ${canonicalId}::uuid WHERE class_type_id = ${dupId}::uuid`);
      await db.execute(sql`UPDATE student_rank_history SET class_type_id = ${canonicalId}::uuid WHERE class_type_id = ${dupId}::uuid`);
      await db.execute(sql`UPDATE student_modality_enrollments SET class_type_id = ${canonicalId}::uuid WHERE class_type_id = ${dupId}::uuid`);

      // 3. Remove o class_type duplicado
      await db.execute(sql`DELETE FROM class_types WHERE id = ${dupId}::uuid`);
      console.log(`   └─ class_type duplicado removido\n`);
    }
  }

  console.log('🎉 Limpeza concluída! Recarregue a página para ver os sistemas consolidados.');
}

main()
  .catch(err => { console.error('\n💥 Erro:', err); process.exit(1); })
  .finally(() => pool.end());
