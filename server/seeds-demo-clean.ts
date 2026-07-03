// Limpa TODOS os dados demo da academia "anjo": alunos com e-mail @ffc.demo ou
// @demo.com e todos os seus registros dependentes (pagamentos, presença,
// matrículas em turma, graduações). Professores e admin são preservados —
// turmas os referenciam.
//
// Uso: npm run seed:demo:clean            (só limpa)
//      npm run seed:demo:reset            (limpa + repovoa via seed:restore)
//
// Exclusivo para desenvolvimento — aborta se NODE_ENV=production.

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { eq, and, or, like, inArray } from 'drizzle-orm';
import {
  academies, users, enrollments,
  studentModalityRanks, studentRankHistory, studentModalityEnrollments,
  attendance, payments, beltHistory,
} from '@shared/schema';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

if (process.env.NODE_ENV === 'production') {
  console.error('❌ seeds-demo-clean é exclusivo para desenvolvimento (NODE_ENV=production detectado).');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function main() {
  console.log('🧹 Limpeza de dados demo — FightFlowCore\n');

  const [academy] = await db.select().from(academies).where(eq(academies.slug, 'anjo'));
  if (!academy) {
    console.log('ℹ️  Academia "anjo" não encontrada — nada a limpar.');
    return;
  }
  console.log(`✅ Academia: ${academy.name} (${academy.id})\n`);

  const demoStudents = await db.select({ id: users.id, email: users.email }).from(users)
    .where(and(
      eq(users.academyId, academy.id),
      eq(users.role, 'ALUNO'),
      or(like(users.email, '%@ffc.demo'), like(users.email, '%@demo.com')),
    ));

  if (demoStudents.length === 0) {
    console.log('ℹ️  Nenhum aluno demo (@ffc.demo / @demo.com) encontrado — nada a limpar.');
    return;
  }

  const ffcCount = demoStudents.filter(s => s.email.endsWith('@ffc.demo')).length;
  const demoCount = demoStudents.length - ffcCount;
  console.log(`🗑️  Removendo ${demoStudents.length} alunos demo (${ffcCount} @ffc.demo + ${demoCount} @demo.com)...\n`);

  const ids = demoStudents.map(s => s.id);

  const steps: [string, () => Promise<unknown>][] = [
    ['Presenças',                () => db.delete(attendance).where(inArray(attendance.studentId, ids))],
    ['Pagamentos',               () => db.delete(payments).where(inArray(payments.studentId, ids))],
    ['Matrículas em turma',      () => db.delete(enrollments).where(inArray(enrollments.studentId, ids))],
    ['Histórico de faixas',      () => db.delete(beltHistory).where(inArray(beltHistory.studentId, ids))],
    ['Histórico de graduações',  () => db.delete(studentRankHistory).where(inArray(studentRankHistory.studentId, ids))],
    ['Graduações por modalidade',() => db.delete(studentModalityRanks).where(inArray(studentModalityRanks.studentId, ids))],
    ['Matrículas em modalidade', () => db.delete(studentModalityEnrollments).where(inArray(studentModalityEnrollments.studentId, ids))],
    ['Alunos',                   () => db.delete(users).where(inArray(users.id, ids))],
  ];

  for (const [label, run] of steps) {
    await run();
    console.log(`   ✓ ${label}`);
  }

  console.log(`\n🎉 Limpeza concluída — ${demoStudents.length} alunos demo removidos.`);
  console.log('   Para repovoar do zero: npm run seed:restore (ou use npm run seed:demo:reset).');
}

main()
  .catch(err => { console.error('\n💥 Erro na limpeza:', err); process.exit(1); })
  .finally(() => pool.end());
