// Faxina das academias criadas pela suíte e2e (slug contém 'e2e').
// GUARDA DURA: aborta se qualquer alvo tiver slug sem 'e2e' — nunca toca em dados reais.
//
// Uso:
//   npm run e2e:clean          → remove
//   npx tsx --env-file=.env server/faxina-e2e.ts list   → só lista
//
// A suíte Playwright cria uma academia por teste (signup) e não tem teardown de
// banco; os specs nomeiam as academias com "E2E" justamente para esta limpeza.

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { like, inArray, count } from 'drizzle-orm';
import {
  academies, users, membershipPlans, classTypes, classes, attendance, payments,
  assinaturas, graduationSystems, graduationRanks, studentModalityRanks,
  studentRankHistory, studentModalityEnrollments, beltHistory, enrollments,
} from '@shared/schema';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function targets() {
  const acs = await db.select().from(academies).where(like(academies.slug, '%e2e%'));
  for (const a of acs) {
    if (!a.slug.toLowerCase().includes('e2e')) throw new Error(`ABORTA: slug inesperado ${a.slug}`);
  }
  return acs;
}

async function del() {
  const acs = await targets();
  const acIds = acs.map(a => a.id);
  if (acIds.length === 0) { console.log('Nada a remover — nenhuma academia e2e no banco.'); return; }
  const us = await db.select({ id: users.id }).from(users).where(inArray(users.academyId, acIds));
  const uIds = us.map(u => u.id);
  const sys = await db.select({ id: graduationSystems.id }).from(graduationSystems).where(inArray(graduationSystems.academyId, acIds));
  const sysIds = sys.map(s => s.id);

  const delIn = async (tbl: any, col: any, ids: string[]) => { if (ids.length) await db.delete(tbl).where(inArray(col, ids)); };

  // Ordem segura de FK (filhos → pais)
  await delIn(enrollments, enrollments.studentId, uIds);
  await delIn(attendance, attendance.academyId, acIds);
  await delIn(payments, payments.academyId, acIds);
  await delIn(studentRankHistory, studentRankHistory.academyId, acIds);
  await delIn(beltHistory, beltHistory.academyId, acIds);
  await delIn(studentModalityRanks, studentModalityRanks.academyId, acIds);
  await delIn(studentModalityEnrollments, studentModalityEnrollments.academyId, acIds);
  await delIn(graduationRanks, graduationRanks.systemId, sysIds);
  await delIn(graduationSystems, graduationSystems.academyId, acIds);
  await delIn(classes, classes.academyId, acIds);
  await delIn(membershipPlans, membershipPlans.academyId, acIds);
  await delIn(classTypes, classTypes.academyId, acIds);
  await delIn(assinaturas, assinaturas.academiaId, acIds);
  await delIn(users, users.academyId, acIds);
  await db.delete(academies).where(inArray(academies.id, acIds));

  console.log(`Removidas ${acIds.length} academias de teste e todos os dados dependentes.`);
  const restAc = await db.select({ n: count() }).from(academies).where(like(academies.slug, '%e2e%'));
  console.log(`Academias com slug ~ e2e restantes: ${restAc[0].n} (esperado 0)`);
}

const mode = process.argv[2] ?? 'delete';
if (mode === 'list') console.log((await targets()).map(a => a.slug).join('\n') || 'nenhuma');
else if (mode === 'delete') await del();
else throw new Error('use: list | delete');
await pool.end();
