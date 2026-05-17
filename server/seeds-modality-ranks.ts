// Popula alunos com matrículas e graduações por modalidade.
// Modalidades: Muay Thai (Corda/Prajied), BJJ (CBJJ/IBJJF), Judô (CBJ).
// Seguro para executar múltiplas vezes — ignora registros já existentes.
// Senha de todos os alunos: Senha@123

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import {
  academies, users, classTypes,
  graduationSystems, graduationRanks,
  studentModalityRanks, studentRankHistory, studentModalityEnrollments,
} from '@shared/schema';

neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthsAgo(n: number, day = 1): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

// ─── Definição das modalidades ────────────────────────────────────────────────

interface RankDef { name: string; displayOrder: number; colorClass: string; }

const SYSTEMS: {
  sport: string;
  systemName: string;
  ranks: RankDef[];
}[] = [
  {
    sport: 'Muay Thai',
    systemName: 'Sistema Brasileiro (Corda / Prajied)',
    ranks: [
      { name: 'Branco',                    displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Branco ponta Vermelha',     displayOrder: 1,  colorClass: '#f9fafb|#dc2626' },
      { name: 'Vermelho',                  displayOrder: 2,  colorClass: '#dc2626' },
      { name: 'Vermelho ponta Azul Clara', displayOrder: 3,  colorClass: '#dc2626|#60a5fa' },
      { name: 'Azul Claro',                displayOrder: 4,  colorClass: '#60a5fa' },
      { name: 'Azul Claro ponta Azul Esc.',displayOrder: 5,  colorClass: '#60a5fa|#1d4ed8' },
      { name: 'Azul Escura',               displayOrder: 6,  colorClass: '#1d4ed8' },
      { name: 'Azul Escura ponta Preta',   displayOrder: 7,  colorClass: '#1d4ed8|#111827' },
      { name: 'Preto',                     displayOrder: 8,  colorClass: '#111827' },
      { name: 'Preto ponta Branca',        displayOrder: 9,  colorClass: '#111827|#f9fafb' },
      { name: 'Preto, Branco e Vermelho',  displayOrder: 10, colorClass: '#111827|#dc2626' },
    ],
  },
  {
    sport: 'BJJ',
    systemName: 'Sistema BJJ (CBJJ/IBJJF)',
    ranks: [
      { name: 'Branca',              displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Cinza e Branca',      displayOrder: 1,  colorClass: '#6b7280|#f9fafb' },
      { name: 'Cinza',               displayOrder: 2,  colorClass: '#6b7280' },
      { name: 'Cinza e Preta',       displayOrder: 3,  colorClass: '#6b7280|#111827' },
      { name: 'Amarela e Branca',    displayOrder: 4,  colorClass: '#facc15|#f9fafb' },
      { name: 'Amarela',             displayOrder: 5,  colorClass: '#facc15' },
      { name: 'Amarela e Preta',     displayOrder: 6,  colorClass: '#facc15|#111827' },
      { name: 'Laranja e Branca',    displayOrder: 7,  colorClass: '#f97316|#f9fafb' },
      { name: 'Laranja',             displayOrder: 8,  colorClass: '#f97316' },
      { name: 'Laranja e Preta',     displayOrder: 9,  colorClass: '#f97316|#111827' },
      { name: 'Verde e Branca',      displayOrder: 10, colorClass: '#15803d|#f9fafb' },
      { name: 'Verde',               displayOrder: 11, colorClass: '#15803d' },
      { name: 'Verde e Preta',       displayOrder: 12, colorClass: '#15803d|#111827' },
      { name: 'Azul',                displayOrder: 13, colorClass: '#2563eb' },
      { name: 'Roxa',                displayOrder: 14, colorClass: '#7c3aed' },
      { name: 'Marrom',              displayOrder: 15, colorClass: '#92400e' },
      { name: 'Preta',               displayOrder: 16, colorClass: '#111827' },
      { name: 'Coral',               displayOrder: 17, colorClass: '#dc2626|#111827' },
      { name: 'Vermelha',            displayOrder: 18, colorClass: '#dc2626' },
    ],
  },
  {
    sport: 'Judô',
    systemName: 'Sistema Judô (CBJ)',
    ranks: [
      { name: 'Branca',      displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Cinza',       displayOrder: 1,  colorClass: '#6b7280' },
      { name: 'Azul Claro',  displayOrder: 2,  colorClass: '#60a5fa' },
      { name: 'Azul Escuro', displayOrder: 3,  colorClass: '#1e40af' },
      { name: 'Amarela',     displayOrder: 4,  colorClass: '#facc15' },
      { name: 'Laranja',     displayOrder: 5,  colorClass: '#f97316' },
      { name: 'Verde',       displayOrder: 6,  colorClass: '#15803d' },
      { name: 'Roxa',        displayOrder: 7,  colorClass: '#7c3aed' },
      { name: 'Marrom',      displayOrder: 8,  colorClass: '#92400e' },
      { name: 'Preta',       displayOrder: 9,  colorClass: '#111827' },
      { name: 'Coral',       displayOrder: 10, colorClass: '#dc2626|#111827' },
      { name: 'Vermelha',    displayOrder: 11, colorClass: '#dc2626' },
    ],
  },
];

// ─── Alunos por modalidade ────────────────────────────────────────────────────

interface StudentDef {
  name: string;
  email: string;
  sport: string;
  rankOrder: number; // índice no array de ranks da modalidade
  joinedMonthsAgo: number;
}

const DEMO_MODALITY_STUDENTS: StudentDef[] = [
  // ── Muay Thai ────────────────────────────────────────────────────────────
  { name: 'João Pires',         email: 'joao.pires@demo.com',         sport: 'Muay Thai', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Renata Dias',        email: 'renata.dias@demo.com',        sport: 'Muay Thai', rankOrder: 1,  joinedMonthsAgo: 3  },
  { name: 'Marcos Teixeira',    email: 'marcos.teixeira@demo.com',    sport: 'Muay Thai', rankOrder: 2,  joinedMonthsAgo: 5  },
  { name: 'Priscila Gomes',     email: 'priscila.gomes@demo.com',     sport: 'Muay Thai', rankOrder: 4,  joinedMonthsAgo: 8  },
  { name: 'Eduardo Nunes',      email: 'eduardo.nunes@demo.com',      sport: 'Muay Thai', rankOrder: 5,  joinedMonthsAgo: 12 },
  { name: 'Tatiana Lima',       email: 'tatiana.lima@demo.com',       sport: 'Muay Thai', rankOrder: 7,  joinedMonthsAgo: 18 },
  { name: 'Alexandre Cruz',     email: 'alexandre.cruz@demo.com',     sport: 'Muay Thai', rankOrder: 8,  joinedMonthsAgo: 24 },
  { name: 'Felipe Corrêa',      email: 'felipe.correa@demo.com',      sport: 'Muay Thai', rankOrder: 10, joinedMonthsAgo: 36 },

  // ── BJJ ──────────────────────────────────────────────────────────────────
  { name: 'Sofia Andrade',      email: 'sofia.andrade@demo.com',      sport: 'BJJ', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Guilherme Souza',    email: 'guilherme.souza@demo.com',    sport: 'BJJ', rankOrder: 2,  joinedMonthsAgo: 4  },
  { name: 'Amanda Lopes',       email: 'amanda.lopes@demo.com',       sport: 'BJJ', rankOrder: 5,  joinedMonthsAgo: 6  },
  { name: 'Ricardo Monteiro',   email: 'ricardo.monteiro@demo.com',   sport: 'BJJ', rankOrder: 9,  joinedMonthsAgo: 10 },
  { name: 'Daniela Fonseca',    email: 'daniela.fonseca@demo.com',    sport: 'BJJ', rankOrder: 13, joinedMonthsAgo: 14 },
  { name: 'Vitor Hugo',         email: 'vitor.hugo@demo.com',         sport: 'BJJ', rankOrder: 14, joinedMonthsAgo: 20 },
  { name: 'Larissa Melo',       email: 'larissa.melo@demo.com',       sport: 'BJJ', rankOrder: 15, joinedMonthsAgo: 28 },
  { name: 'Paulo Sérgio',       email: 'paulo.sergio@demo.com',       sport: 'BJJ', rankOrder: 16, joinedMonthsAgo: 42 },

  // ── Judô ─────────────────────────────────────────────────────────────────
  { name: 'Beatriz Cunha',      email: 'beatriz.cunha@demo.com',      sport: 'Judô', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Gabriel Torres',     email: 'gabriel.torres@demo.com',     sport: 'Judô', rankOrder: 1,  joinedMonthsAgo: 3  },
  { name: 'Natalia Barbosa',    email: 'natalia.barbosa@demo.com',    sport: 'Judô', rankOrder: 2,  joinedMonthsAgo: 5  },
  { name: 'Henrique Vieira',    email: 'henrique.vieira@demo.com',    sport: 'Judô', rankOrder: 4,  joinedMonthsAgo: 9  },
  { name: 'Melissa Rodrigues',  email: 'melissa.rodrigues@demo.com',  sport: 'Judô', rankOrder: 6,  joinedMonthsAgo: 15 },
  { name: 'Roberto Cavalcante', email: 'roberto.cavalcante@demo.com', sport: 'Judô', rankOrder: 8,  joinedMonthsAgo: 22 },
  { name: 'Cristina Prado',     email: 'cristina.prado@demo.com',     sport: 'Judô', rankOrder: 9,  joinedMonthsAgo: 30 },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Seed: alunos por modalidade (Muay Thai · BJJ · Judô)\n');

  // 1. Academia
  const [academy] = await db.select().from(academies).where(eq(academies.slug, 'anjo'));
  if (!academy) {
    console.error('❌ Academia "anjo" não encontrada. Execute o app e cadastre-a primeiro.');
    process.exit(1);
  }
  console.log(`✅ Academia: ${academy.name}\n`);

  // 2. Admin (usado como promotedBy)
  const [admin] = await db.select().from(users)
    .where(and(eq(users.academyId, academy.id), eq(users.role, 'ADMIN_ACADEMIA')));
  if (!admin) { console.error('❌ Nenhum ADMIN_ACADEMIA encontrado.'); process.exit(1); }

  // 3. Garante class types para cada esporte
  const classTypeMap = new Map<string, string>(); // sport → classTypeId

  for (const sys of SYSTEMS) {
    const existing = await db.select().from(classTypes)
      .where(and(eq(classTypes.academyId, academy.id), eq(classTypes.name, sys.sport)));

    let ct = existing[0];
    if (!ct) {
      [ct] = await db.insert(classTypes).values({
        academyId: academy.id,
        name: sys.sport,
        duration: 90,
        maxCapacity: 25,
        active: true,
      }).returning();
      console.log(`✅ Modalidade criada: ${sys.sport}`);
    } else {
      // Reativa caso esteja inativa
      if (!ct.active) {
        await db.update(classTypes).set({ active: true }).where(eq(classTypes.id, ct.id));
        console.log(`♻️  Modalidade reativada: ${sys.sport}`);
      } else {
        console.log(`⚠️  Modalidade já existe: ${sys.sport}`);
      }
    }
    classTypeMap.set(sys.sport, ct.id);
  }
  console.log();

  // 4. Garante sistemas de graduação e seus ranks
  // Retorna Map<sport, Map<displayOrder, rankId>>
  const rankIdBySportAndOrder = new Map<string, Map<number, string>>();

  for (const sysDef of SYSTEMS) {
    const ctId = classTypeMap.get(sysDef.sport)!;

    // Verifica se já existe sistema para essa modalidade
    const existingSys = await db.select().from(graduationSystems)
      .where(and(
        eq(graduationSystems.academyId, academy.id),
        eq(graduationSystems.classTypeId, ctId),
      ));

    let sysId: string;

    if (existingSys.length > 0) {
      sysId = existingSys[0].id;
      console.log(`⚠️  Sistema de graduação já existe: ${sysDef.systemName}`);
    } else {
      const [created] = await db.insert(graduationSystems).values({
        academyId: academy.id,
        classTypeId: ctId,
        name: sysDef.systemName,
      }).returning();
      sysId = created.id;
      console.log(`✅ Sistema criado: ${sysDef.systemName}`);
    }

    // Busca ranks existentes para este sistema
    const existingRanks = await db.select().from(graduationRanks)
      .where(eq(graduationRanks.systemId, sysId));

    const orderMap = new Map<number, string>();

    for (const r of existingRanks) {
      orderMap.set(r.displayOrder, r.id);
    }

    // Insere ranks faltantes
    let inserted = 0;
    for (const rankDef of sysDef.ranks) {
      if (!orderMap.has(rankDef.displayOrder)) {
        const [created] = await db.insert(graduationRanks).values({
          systemId: sysId,
          name: rankDef.name,
          displayOrder: rankDef.displayOrder,
          colorClass: rankDef.colorClass,
        }).returning();
        orderMap.set(rankDef.displayOrder, created.id);
        inserted++;
      }
    }

    if (inserted > 0) console.log(`   └─ ${inserted} graduações inseridas`);

    rankIdBySportAndOrder.set(sysDef.sport, orderMap);
  }
  console.log();

  // 5. Cria alunos + matrículas + ranks
  const password = await bcrypt.hash('Senha@123', 10);

  for (const s of DEMO_MODALITY_STUDENTS) {
    const ctId = classTypeMap.get(s.sport)!;
    const rankMap = rankIdBySportAndOrder.get(s.sport)!;
    const rankId = rankMap.get(s.rankOrder);

    if (!rankId) {
      console.warn(`⚠️  Rank order ${s.rankOrder} não encontrado para ${s.sport}, pulando ${s.name}`);
      continue;
    }

    // Verifica se aluno já existe
    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, s.email));

    let studentId: string;

    if (existing.length > 0) {
      studentId = existing[0].id;
      console.log(`⚠️  ${s.name} já existe, verificando matrícula...`);
    } else {
      const [student] = await db.insert(users).values({
        email: s.email,
        password,
        name: s.name,
        role: 'ALUNO',
        academyId: academy.id,
        belt: 'branca',
        active: true,
        firstAccess: false,
        createdAt: monthsAgo(s.joinedMonthsAgo),
      }).returning();
      studentId = student.id;
    }

    // Matrícula na modalidade (se não existir)
    const existingEnroll = await db.select({ id: studentModalityEnrollments.id })
      .from(studentModalityEnrollments)
      .where(and(
        eq(studentModalityEnrollments.studentId, studentId),
        eq(studentModalityEnrollments.classTypeId, ctId),
      ));

    if (existingEnroll.length === 0) {
      await db.insert(studentModalityEnrollments).values({
        studentId,
        academyId: academy.id,
        classTypeId: ctId,
        enrolledAt: monthsAgo(s.joinedMonthsAgo),
      });
    }

    // Rank atual na modalidade (upsert via delete + insert para simplicidade)
    const existingRank = await db.select({ id: studentModalityRanks.id })
      .from(studentModalityRanks)
      .where(and(
        eq(studentModalityRanks.studentId, studentId),
        eq(studentModalityRanks.classTypeId, ctId),
      ));

    const promotedAt = monthsAgo(Math.max(s.joinedMonthsAgo - 1, 0), 15);

    if (existingRank.length === 0) {
      await db.insert(studentModalityRanks).values({
        studentId,
        academyId: academy.id,
        classTypeId: ctId,
        rankId,
        promotedAt,
        promotedBy: admin.id,
      });

      // Histórico de rank (apenas se não for rank inicial)
      if (s.rankOrder > 0) {
        const prevRankId = rankMap.get(s.rankOrder - 1);
        await db.insert(studentRankHistory).values({
          studentId,
          academyId: academy.id,
          classTypeId: ctId,
          rankBeforeId: prevRankId ?? null,
          rankAfterId: rankId,
          promotedBy: admin.id,
          promotedAt,
          notes: 'Graduação registrada via seed de demonstração',
        });
      }
    }

    const sysDef = SYSTEMS.find(x => x.sport === s.sport)!;
    const rankName = sysDef.ranks[s.rankOrder]?.name ?? '?';
    console.log(`✅ ${s.name.padEnd(24)} [${s.sport.padEnd(9)}] ${rankName}`);
  }

  console.log('\n🎉 Seed concluído!');
  console.log('   23 alunos distribuídos em Muay Thai, BJJ e Judô.');
  console.log('   Senha de todos: Senha@123');
}

main()
  .catch(err => { console.error('\n💥 Erro no seed:', err); process.exit(1); })
  .finally(() => pool.end());
