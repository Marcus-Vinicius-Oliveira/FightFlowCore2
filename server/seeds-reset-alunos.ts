// Apaga TODOS os alunos da academia "anjo" e repopula com dados realistas.
// Inclui: info completa (telefone, nascimento), múltiplas modalidades por aluno,
// graduações diversas e histórico de pagamentos.
// Senha de todos os alunos: Senha@123

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import { eq, and, inArray } from 'drizzle-orm';
import {
  academies, users, membershipPlans, classTypes, enrollments,
  graduationSystems, graduationRanks,
  studentModalityRanks, studentRankHistory, studentModalityEnrollments,
  attendance, payments, beltHistory,
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
  d.setMilliseconds(0);
  return d;
}

// ─── Sistemas de graduação ────────────────────────────────────────────────────

interface RankDef { name: string; displayOrder: number; colorClass: string; }

const SYSTEMS: { sport: string; systemName: string; ranks: RankDef[] }[] = [
  {
    sport: 'Muay Thai',
    systemName: 'Sistema Brasileiro (Corda / Prajied)',
    ranks: [
      { name: 'Branco',                     displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Branco ponta Vermelha',      displayOrder: 1,  colorClass: '#f9fafb|#dc2626' },
      { name: 'Vermelho',                   displayOrder: 2,  colorClass: '#dc2626' },
      { name: 'Vermelho ponta Azul Clara',  displayOrder: 3,  colorClass: '#dc2626|#60a5fa' },
      { name: 'Azul Claro',                 displayOrder: 4,  colorClass: '#60a5fa' },
      { name: 'Azul Claro ponta Azul Esc.', displayOrder: 5,  colorClass: '#60a5fa|#1d4ed8' },
      { name: 'Azul Escura',                displayOrder: 6,  colorClass: '#1d4ed8' },
      { name: 'Azul Escura ponta Preta',    displayOrder: 7,  colorClass: '#1d4ed8|#111827' },
      { name: 'Preto',                      displayOrder: 8,  colorClass: '#111827' },
      { name: 'Preto ponta Branca',         displayOrder: 9,  colorClass: '#111827|#f9fafb' },
      { name: 'Preto, Branco e Vermelho',   displayOrder: 10, colorClass: '#111827|#dc2626' },
    ],
  },
  {
    sport: 'BJJ',
    systemName: 'Sistema BJJ (CBJJ/IBJJF)',
    ranks: [
      { name: 'Branca',           displayOrder: 0,  colorClass: '#f9fafb' },
      { name: 'Cinza e Branca',   displayOrder: 1,  colorClass: '#6b7280|#f9fafb' },
      { name: 'Cinza',            displayOrder: 2,  colorClass: '#6b7280' },
      { name: 'Cinza e Preta',    displayOrder: 3,  colorClass: '#6b7280|#111827' },
      { name: 'Amarela e Branca', displayOrder: 4,  colorClass: '#facc15|#f9fafb' },
      { name: 'Amarela',          displayOrder: 5,  colorClass: '#facc15' },
      { name: 'Amarela e Preta',  displayOrder: 6,  colorClass: '#facc15|#111827' },
      { name: 'Laranja e Branca', displayOrder: 7,  colorClass: '#f97316|#f9fafb' },
      { name: 'Laranja',          displayOrder: 8,  colorClass: '#f97316' },
      { name: 'Laranja e Preta',  displayOrder: 9,  colorClass: '#f97316|#111827' },
      { name: 'Verde e Branca',   displayOrder: 10, colorClass: '#15803d|#f9fafb' },
      { name: 'Verde',            displayOrder: 11, colorClass: '#15803d' },
      { name: 'Verde e Preta',    displayOrder: 12, colorClass: '#15803d|#111827' },
      { name: 'Azul',             displayOrder: 13, colorClass: '#2563eb' },
      { name: 'Roxa',             displayOrder: 14, colorClass: '#7c3aed' },
      { name: 'Marrom',           displayOrder: 15, colorClass: '#92400e' },
      { name: 'Preta',            displayOrder: 16, colorClass: '#111827' },
      { name: 'Coral',            displayOrder: 17, colorClass: '#dc2626|#111827' },
      { name: 'Vermelha',         displayOrder: 18, colorClass: '#dc2626' },
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

// ─── Definição dos alunos ─────────────────────────────────────────────────────

interface ModalityEnrollment {
  sport: string;
  rankOrder: number;
  enrolledMonthsAgo: number;
}

interface StudentDef {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  joinedMonthsAgo: number; // data mais antiga (quando entrou na academia)
  active: boolean;
  overdue?: boolean;
  modalities: ModalityEnrollment[];
}

const DEMO_STUDENTS: StudentDef[] = [
  // ── Múltiplas modalidades ─────────────────────────────────────────────────

  {
    name: 'Rafael Torres Brandão',
    email: 'rafael.torres@demo.com',
    phone: '11997234561',
    dateOfBirth: new Date('1994-03-15'),
    joinedMonthsAgo: 24,
    active: true,
    modalities: [
      { sport: 'BJJ',       rankOrder: 13, enrolledMonthsAgo: 24 }, // Azul
      { sport: 'Muay Thai', rankOrder: 2,  enrolledMonthsAgo: 12 }, // Vermelho
    ],
  },
  {
    name: 'Camila Duarte Fonseca',
    email: 'camila.duarte@demo.com',
    phone: '21998453290',
    dateOfBirth: new Date('1997-07-22'),
    joinedMonthsAgo: 18,
    active: true,
    modalities: [
      { sport: 'BJJ',  rankOrder: 11, enrolledMonthsAgo: 18 }, // Verde
      { sport: 'Judô', rankOrder: 4,  enrolledMonthsAgo: 6  }, // Amarela
    ],
  },
  {
    name: 'Bruno Cavalcanti Lima',
    email: 'bruno.cavalcanti@demo.com',
    phone: '11993765421',
    dateOfBirth: new Date('1991-11-08'),
    joinedMonthsAgo: 30,
    active: true,
    modalities: [
      { sport: 'Muay Thai', rankOrder: 6, enrolledMonthsAgo: 30 }, // Azul Escura
      { sport: 'Judô',      rankOrder: 7, enrolledMonthsAgo: 15 }, // Roxa
    ],
  },
  {
    name: 'Ana Luisa Monteiro',
    email: 'ana.monteiro@demo.com',
    phone: '31999876543',
    dateOfBirth: new Date('1995-04-30'),
    joinedMonthsAgo: 36,
    active: true,
    modalities: [
      { sport: 'BJJ',       rankOrder: 14, enrolledMonthsAgo: 36 }, // Roxa
      { sport: 'Muay Thai', rankOrder: 5,  enrolledMonthsAgo: 24 }, // Azul Claro ponta Azul Esc.
      { sport: 'Judô',      rankOrder: 5,  enrolledMonthsAgo: 12 }, // Laranja
    ],
  },
  {
    name: 'Pedro Henrique Santos',
    email: 'pedro.santos@demo.com',
    phone: '11994512378',
    dateOfBirth: new Date('1989-09-12'),
    joinedMonthsAgo: 42,
    active: true,
    modalities: [
      { sport: 'BJJ',       rankOrder: 15, enrolledMonthsAgo: 42 }, // Marrom
      { sport: 'Muay Thai', rankOrder: 7,  enrolledMonthsAgo: 18 }, // Azul Escura ponta Preta
    ],
  },
  {
    name: 'Larissa Beatriz Ramos',
    email: 'larissa.ramos@demo.com',
    phone: '21997654321',
    dateOfBirth: new Date('2001-01-18'),
    joinedMonthsAgo: 15,
    active: true,
    modalities: [
      { sport: 'Judô', rankOrder: 6, enrolledMonthsAgo: 15 }, // Verde
      { sport: 'BJJ',  rankOrder: 0, enrolledMonthsAgo: 1  }, // Branca (novata no BJJ)
    ],
  },
  {
    name: 'Gustavo Ferreira Neto',
    email: 'gustavo.neto@demo.com',
    phone: '11996789012',
    dateOfBirth: new Date('1985-06-25'),
    joinedMonthsAgo: 60,
    active: true,
    modalities: [
      { sport: 'Muay Thai', rankOrder: 9, enrolledMonthsAgo: 60 }, // Preto ponta Branca
      { sport: 'Judô',      rankOrder: 9, enrolledMonthsAgo: 48 }, // Preta
    ],
  },

  // ── BJJ ──────────────────────────────────────────────────────────────────

  {
    name: 'Thiago Costa Almeida',
    email: 'thiago.almeida@demo.com',
    phone: '11998123456',
    dateOfBirth: new Date('2003-05-10'),
    joinedMonthsAgo: 2,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 0, enrolledMonthsAgo: 2 }], // Branca
  },
  {
    name: 'Vanessa Prado Oliveira',
    email: 'vanessa.prado@demo.com',
    phone: '21997890123',
    dateOfBirth: new Date('2000-08-16'),
    joinedMonthsAgo: 5,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 2, enrolledMonthsAgo: 5 }], // Cinza
  },
  {
    name: 'Carlos Eduardo Silva',
    email: 'carlos.silva@demo.com',
    phone: '11992345678',
    dateOfBirth: new Date('1998-12-03'),
    joinedMonthsAgo: 9,
    active: true,
    overdue: true,
    modalities: [{ sport: 'BJJ', rankOrder: 6, enrolledMonthsAgo: 9 }], // Amarela e Preta
  },
  {
    name: 'Mariana Souza Batista',
    email: 'mariana.batista@demo.com',
    phone: '31996543210',
    dateOfBirth: new Date('1996-02-28'),
    joinedMonthsAgo: 12,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 8, enrolledMonthsAgo: 12 }], // Laranja
  },
  {
    name: 'Diego Augusto Nascimento',
    email: 'diego.nascimento@demo.com',
    phone: '11991234567',
    dateOfBirth: new Date('1993-10-14'),
    joinedMonthsAgo: 16,
    active: false, // inativo
    overdue: true,
    modalities: [{ sport: 'BJJ', rankOrder: 12, enrolledMonthsAgo: 16 }], // Verde e Preta
  },
  {
    name: 'Juliana Cristina Cardoso',
    email: 'juliana.cardoso@demo.com',
    phone: '21995678901',
    dateOfBirth: new Date('1991-07-04'),
    joinedMonthsAgo: 22,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 13, enrolledMonthsAgo: 22 }], // Azul
  },
  {
    name: 'Rodrigo Henrique Melo',
    email: 'rodrigo.melo@demo.com',
    phone: '11990123456',
    dateOfBirth: new Date('1988-04-19'),
    joinedMonthsAgo: 32,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 14, enrolledMonthsAgo: 32 }], // Roxa
  },
  {
    name: 'Patricia Gomes Ramos',
    email: 'patricia.ramos@demo.com',
    phone: '31994321098',
    dateOfBirth: new Date('1986-09-07'),
    joinedMonthsAgo: 48,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 15, enrolledMonthsAgo: 48 }], // Marrom
  },
  {
    name: 'Alexandre João Vieira',
    email: 'alexandre.vieira@demo.com',
    phone: '11993210987',
    dateOfBirth: new Date('1978-11-23'),
    joinedMonthsAgo: 72,
    active: true,
    modalities: [{ sport: 'BJJ', rankOrder: 16, enrolledMonthsAgo: 72 }], // Preta
  },

  // ── Muay Thai ─────────────────────────────────────────────────────────────

  {
    name: 'João Victor Pires',
    email: 'joao.pires@demo.com',
    phone: '11998765432',
    dateOfBirth: new Date('2005-03-08'),
    joinedMonthsAgo: 1,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 0, enrolledMonthsAgo: 1 }], // Branco
  },
  {
    name: 'Renata Cristina Dias',
    email: 'renata.dias@demo.com',
    phone: '21997654320',
    dateOfBirth: new Date('2002-06-15'),
    joinedMonthsAgo: 4,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 1, enrolledMonthsAgo: 4 }], // Branco ponta Vermelha
  },
  {
    name: 'Marcos Antônio Cruz',
    email: 'marcos.cruz@demo.com',
    phone: '11991234560',
    dateOfBirth: new Date('1999-01-22'),
    joinedMonthsAgo: 8,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 3, enrolledMonthsAgo: 8 }], // Vermelho ponta Azul Clara
  },
  {
    name: 'Eduardo Paulo Nunes',
    email: 'eduardo.nunes@demo.com',
    phone: '31995678900',
    dateOfBirth: new Date('1996-04-11'),
    joinedMonthsAgo: 14,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 4, enrolledMonthsAgo: 14 }], // Azul Claro
  },
  {
    name: 'Tatiana Fernanda Lima',
    email: 'tatiana.lima@demo.com',
    phone: '11993456789',
    dateOfBirth: new Date('1993-08-30'),
    joinedMonthsAgo: 22,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 6, enrolledMonthsAgo: 22 }], // Azul Escura
  },
  {
    name: 'Fernanda Cristina Ramos',
    email: 'fernanda.ramos@demo.com',
    phone: '21996789010',
    dateOfBirth: new Date('1990-02-17'),
    joinedMonthsAgo: 32,
    active: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 7, enrolledMonthsAgo: 32 }], // Azul Escura ponta Preta
  },
  {
    name: 'Roberto Carlos Azevedo',
    email: 'roberto.azevedo@demo.com',
    phone: '11994567891',
    dateOfBirth: new Date('1982-05-29'),
    joinedMonthsAgo: 60,
    active: true,
    overdue: true,
    modalities: [{ sport: 'Muay Thai', rankOrder: 10, enrolledMonthsAgo: 60 }], // Preto, Branco e Vermelho
  },

  // ── Judô ─────────────────────────────────────────────────────────────────

  {
    name: 'Beatriz Helena Cunha',
    email: 'beatriz.cunha@demo.com',
    phone: '31998901234',
    dateOfBirth: new Date('2004-09-12'),
    joinedMonthsAgo: 2,
    active: true,
    modalities: [{ sport: 'Judô', rankOrder: 0, enrolledMonthsAgo: 2 }], // Branca
  },
  {
    name: 'Gabriel André Torres',
    email: 'gabriel.torres@demo.com',
    phone: '11997890120',
    dateOfBirth: new Date('2001-03-05'),
    joinedMonthsAgo: 5,
    active: true,
    modalities: [{ sport: 'Judô', rankOrder: 1, enrolledMonthsAgo: 5 }], // Cinza
  },
  {
    name: 'Natalia Paula Barbosa',
    email: 'natalia.barbosa@demo.com',
    phone: '21995432100',
    dateOfBirth: new Date('1998-07-18'),
    joinedMonthsAgo: 9,
    active: true,
    modalities: [{ sport: 'Judô', rankOrder: 2, enrolledMonthsAgo: 9 }], // Azul Claro
  },
  {
    name: 'Henrique Vieira Duarte',
    email: 'henrique.duarte@demo.com',
    phone: '11992345670',
    dateOfBirth: new Date('1995-11-25'),
    joinedMonthsAgo: 15,
    active: true,
    modalities: [{ sport: 'Judô', rankOrder: 4, enrolledMonthsAgo: 15 }], // Amarela
  },
  {
    name: 'Melissa Rodriguez Costa',
    email: 'melissa.costa@demo.com',
    phone: '31993456780',
    dateOfBirth: new Date('1990-04-03'),
    joinedMonthsAgo: 28,
    active: true,
    modalities: [{ sport: 'Judô', rankOrder: 6, enrolledMonthsAgo: 28 }], // Verde
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🗑️  Iniciando reset de alunos...\n');

  // 1. Academia
  const [academy] = await db.select().from(academies).where(eq(academies.slug, 'anjo'));
  if (!academy) {
    console.error('❌ Academia "anjo" não encontrada. Execute o app e cadastre-a primeiro.');
    process.exit(1);
  }
  console.log(`✅ Academia: ${academy.name} (${academy.id})\n`);

  // 2. Admin (usado como promotedBy e para não ser deletado)
  const [admin] = await db.select().from(users)
    .where(and(eq(users.academyId, academy.id), eq(users.role, 'ADMIN_ACADEMIA')));
  if (!admin) {
    console.error('❌ Nenhum ADMIN_ACADEMIA encontrado.');
    process.exit(1);
  }

  // ── FASE 1: DELETE ────────────────────────────────────────────────────────

  const alunoIds = (
    await db.select({ id: users.id }).from(users)
      .where(and(eq(users.academyId, academy.id), eq(users.role, 'ALUNO')))
  ).map(r => r.id);

  if (alunoIds.length === 0) {
    console.log('ℹ️  Nenhum aluno encontrado. Pulando fase de deleção.\n');
  } else {
    console.log(`🗑️  Apagando ${alunoIds.length} alunos e seus registros...\n`);

    await db.delete(attendance).where(inArray(attendance.studentId, alunoIds));
    console.log('   ✓ Frequência apagada');

    await db.delete(payments).where(inArray(payments.studentId, alunoIds));
    console.log('   ✓ Pagamentos apagados');

    await db.delete(enrollments).where(inArray(enrollments.studentId, alunoIds));
    console.log('   ✓ Matrículas em turma apagadas');

    await db.delete(beltHistory).where(inArray(beltHistory.studentId, alunoIds));
    console.log('   ✓ Histórico de faixas apagado');

    await db.delete(studentRankHistory).where(inArray(studentRankHistory.studentId, alunoIds));
    console.log('   ✓ Histórico de ranks apagado');

    await db.delete(studentModalityRanks).where(inArray(studentModalityRanks.studentId, alunoIds));
    console.log('   ✓ Ranks por modalidade apagados');

    await db.delete(studentModalityEnrollments).where(inArray(studentModalityEnrollments.studentId, alunoIds));
    console.log('   ✓ Matrículas por modalidade apagadas');

    await db.delete(users).where(inArray(users.id, alunoIds));
    console.log(`   ✓ ${alunoIds.length} usuários ALUNO apagados\n`);
  }

  // ── FASE 2: INFRAESTRUTURA ────────────────────────────────────────────────

  // Plano de mensalidade
  let plan = (await db.select().from(membershipPlans)
    .where(eq(membershipPlans.academyId, academy.id)))[0];
  if (!plan) {
    [plan] = await db.insert(membershipPlans).values({
      academyId: academy.id,
      name: 'Mensal Padrão',
      description: 'Acesso ilimitado a todas as turmas',
      price: 15000,
      duration: 30,
      classesPerWeek: 3,
      active: true,
    }).returning();
    console.log('✅ Plano criado: Mensal Padrão (R$ 150,00/mês)');
  }

  // Class types + graduation systems
  const classTypeMap = new Map<string, string>(); // sport → classTypeId
  const rankIdBySportAndOrder = new Map<string, Map<number, string>>();

  console.log('\n🥋 Verificando modalidades e sistemas de graduação...\n');

  for (const sysDef of SYSTEMS) {
    // ClassType
    let ct = (await db.select().from(classTypes)
      .where(and(eq(classTypes.academyId, academy.id), eq(classTypes.name, sysDef.sport))))[0];
    if (!ct) {
      [ct] = await db.insert(classTypes).values({
        academyId: academy.id,
        name: sysDef.sport,
        duration: 90,
        maxCapacity: 25,
        active: true,
      }).returning();
      console.log(`   ✅ Modalidade criada: ${sysDef.sport}`);
    } else {
      if (!ct.active) {
        await db.update(classTypes).set({ active: true }).where(eq(classTypes.id, ct.id));
        console.log(`   ♻️  Modalidade reativada: ${sysDef.sport}`);
      } else {
        console.log(`   ⚠️  Modalidade existente: ${sysDef.sport}`);
      }
    }
    classTypeMap.set(sysDef.sport, ct.id);

    // GraduationSystem
    let sys = (await db.select().from(graduationSystems)
      .where(and(
        eq(graduationSystems.academyId, academy.id),
        eq(graduationSystems.classTypeId, ct.id),
      )))[0];
    if (!sys) {
      [sys] = await db.insert(graduationSystems).values({
        academyId: academy.id,
        classTypeId: ct.id,
        name: sysDef.systemName,
      }).returning();
      console.log(`   ✅ Sistema criado: ${sysDef.systemName}`);
    }

    // Ranks (upsert por displayOrder)
    const existingRanks = await db.select().from(graduationRanks)
      .where(eq(graduationRanks.systemId, sys.id));
    const orderMap = new Map<number, string>(existingRanks.map(r => [r.displayOrder, r.id]));

    let inserted = 0;
    for (const r of sysDef.ranks) {
      if (!orderMap.has(r.displayOrder)) {
        const [created] = await db.insert(graduationRanks).values({
          systemId: sys.id,
          name: r.name,
          displayOrder: r.displayOrder,
          colorClass: r.colorClass,
        }).returning();
        orderMap.set(r.displayOrder, created.id);
        inserted++;
      }
    }
    if (inserted > 0) console.log(`      └─ ${inserted} graduações inseridas`);
    rankIdBySportAndOrder.set(sysDef.sport, orderMap);
  }

  // ── FASE 3: ALUNOS ────────────────────────────────────────────────────────

  console.log('\n👥 Criando alunos...\n');

  const password = await bcrypt.hash('Senha@123', 10);
  let total = 0;
  let multiCount = 0;

  for (const s of DEMO_STUDENTS) {
    // Cria usuário
    const joinDate = monthsAgo(s.joinedMonthsAgo);

    const [student] = await db.insert(users).values({
      email: s.email,
      password,
      name: s.name,
      role: 'ALUNO',
      academyId: academy.id,
      phone: s.phone,
      dateOfBirth: s.dateOfBirth,
      belt: 'branca',
      active: s.active,
      firstAccess: false,
      createdAt: joinDate,
    }).returning();

    // Matrículas por modalidade + ranks
    for (const m of s.modalities) {
      const ctId = classTypeMap.get(m.sport);
      const rankMap = rankIdBySportAndOrder.get(m.sport);
      if (!ctId || !rankMap) { console.warn(`   ⚠️  ${m.sport} não encontrado`); continue; }

      const rankId = rankMap.get(m.rankOrder);
      if (!rankId) { console.warn(`   ⚠️  Rank ordem ${m.rankOrder} não encontrado em ${m.sport}`); continue; }

      const enrollDate = monthsAgo(m.enrolledMonthsAgo);
      const promotedAt = monthsAgo(Math.max(m.enrolledMonthsAgo - 1, 0), 15);

      await db.insert(studentModalityEnrollments).values({
        studentId: student.id,
        academyId: academy.id,
        classTypeId: ctId,
        enrolledAt: enrollDate,
        active: true,
      });

      await db.insert(studentModalityRanks).values({
        studentId: student.id,
        academyId: academy.id,
        classTypeId: ctId,
        rankId,
        promotedAt,
        promotedBy: admin.id,
      });

      // Histórico de rank (apenas se não for o rank inicial)
      if (m.rankOrder > 0) {
        const prevRankId = rankMap.get(m.rankOrder - 1) ?? null;
        await db.insert(studentRankHistory).values({
          studentId: student.id,
          academyId: academy.id,
          classTypeId: ctId,
          rankBeforeId: prevRankId,
          rankAfterId: rankId,
          promotedBy: admin.id,
          promotedAt,
          notes: 'Graduação registrada via seed de demonstração',
        });
      }
    }

    // Pagamentos — um por mês desde o ingresso
    const paymentRows = [];
    for (let mo = s.joinedMonthsAgo; mo >= 0; mo--) {
      const dueDate = monthsAgo(mo, 5);
      let status: string;
      let paidDate: Date | undefined;

      if (s.overdue && mo <= 1) {
        status = 'overdue';
      } else if (mo === 0) {
        const rand = Math.random();
        if (rand < 0.65) {
          status = 'paid';
          paidDate = new Date(dueDate);
          paidDate.setDate(paidDate.getDate() + 2);
        } else {
          status = 'pending';
        }
      } else {
        status = 'paid';
        paidDate = new Date(dueDate);
        paidDate.setDate(paidDate.getDate() + Math.ceil(Math.random() * 4));
      }

      paymentRows.push({
        studentId: student.id,
        academyId: academy.id,
        membershipPlanId: plan.id,
        amount: plan.price,
        dueDate,
        ...(paidDate ? { paidDate } : {}),
        status,
      });
    }
    if (paymentRows.length > 0) await db.insert(payments).values(paymentRows);

    // Log
    const mods = s.modalities.map(m => {
      const sysDef = SYSTEMS.find(x => x.sport === m.sport)!;
      const rankName = sysDef.ranks[m.rankOrder]?.name ?? '?';
      return `${m.sport}: ${rankName}`;
    }).join(' | ');

    const statusTag = !s.active ? ' [INATIVO]' : (s.overdue ? ' ⚠️  inadimplente' : '');
    const isMulti = s.modalities.length > 1;
    if (isMulti) multiCount++;

    console.log(`   ✅ ${s.name.padEnd(26)} ${mods}${statusTag}`);
    total++;
  }

  console.log(`\n🎉 Reset concluído!`);
  console.log(`   • ${total} alunos criados`);
  console.log(`   • ${multiCount} alunos em múltiplas modalidades`);
  console.log(`   • 3 alunos inadimplentes / 1 aluno inativo`);
  console.log(`   • Modalidades: BJJ, Muay Thai, Judô`);
  console.log(`   • Senha de todos: Senha@123`);
}

main()
  .catch(err => { console.error('\n💥 Erro no seed:', err); process.exit(1); })
  .finally(() => pool.end());
