// Restauração completa do banco a partir do zero.
// Cria: academia, admin, professor, planos, assinatura, 3 modalidades com sistemas
// de graduação, 28 alunos com dados completos, pagamentos e presença.
// Idempotente — seguro para executar múltiplas vezes.
// Credenciais do admin: mvoli@gmail.com / Senha@123

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import {
  academies, users, planos, assinaturas, membershipPlans,
  classTypes, classes,
  graduationSystems, graduationRanks,
  studentModalityRanks, studentRankHistory, studentModalityEnrollments,
  payments, attendance, beltHistory,
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

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(14, 0, 0, 0);
  d.setMilliseconds(0);
  return d;
}

function yearsAgo(years: number, month = 6, day = 15): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years, month - 1, day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Sistemas de graduação ────────────────────────────────────────────────────

interface RankDef { name: string; displayOrder: number; colorClass: string; }

const GRADUATION_SYSTEMS: { sport: string; systemName: string; ranks: RankDef[] }[] = [
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

// ─── Alunos ───────────────────────────────────────────────────────────────────

interface StudentDef {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  sport: string;
  rankOrder: number;
  joinedMonthsAgo: number;
  overdue?: boolean;
}

const STUDENTS: StudentDef[] = [
  // ── Muay Thai (10) ────────────────────────────────────────────────────────
  { name: 'João Pires',        email: 'joao.pires@ffc.demo',        phone: '11991230001', dateOfBirth: yearsAgo(24, 3, 10), sport: 'Muay Thai', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Renata Dias',       email: 'renata.dias@ffc.demo',       phone: '11991230002', dateOfBirth: yearsAgo(27, 7, 22), sport: 'Muay Thai', rankOrder: 1,  joinedMonthsAgo: 3  },
  { name: 'Marcos Vidal',      email: 'marcos.vidal@ffc.demo',      phone: '11991230003', dateOfBirth: yearsAgo(31, 1, 5),  sport: 'Muay Thai', rankOrder: 2,  joinedMonthsAgo: 5,  overdue: true },
  { name: 'Priscila Gomes',    email: 'priscila.gomes@ffc.demo',    phone: '11991230004', dateOfBirth: yearsAgo(22, 9, 14), sport: 'Muay Thai', rankOrder: 4,  joinedMonthsAgo: 8  },
  { name: 'Eduardo Nunes',     email: 'eduardo.nunes@ffc.demo',     phone: '11991230005', dateOfBirth: yearsAgo(35, 4, 30), sport: 'Muay Thai', rankOrder: 5,  joinedMonthsAgo: 12 },
  { name: 'Tatiana Lima',      email: 'tatiana.lima@ffc.demo',      phone: '11991230006', dateOfBirth: yearsAgo(28, 11, 3), sport: 'Muay Thai', rankOrder: 7,  joinedMonthsAgo: 18 },
  { name: 'Alexandre Cruz',    email: 'alexandre.cruz@ffc.demo',    phone: '11991230007', dateOfBirth: yearsAgo(33, 2, 19), sport: 'Muay Thai', rankOrder: 8,  joinedMonthsAgo: 24 },
  { name: 'Felipe Corrêa',     email: 'felipe.correa@ffc.demo',     phone: '11991230008', dateOfBirth: yearsAgo(40, 6, 8),  sport: 'Muay Thai', rankOrder: 10, joinedMonthsAgo: 36 },
  { name: 'Camila Assis',      email: 'camila.assis@ffc.demo',      phone: '11991230009', dateOfBirth: yearsAgo(20, 8, 25), sport: 'Muay Thai', rankOrder: 3,  joinedMonthsAgo: 6  },
  { name: 'Diego Fonseca',     email: 'diego.fonseca@ffc.demo',     phone: '11991230010', dateOfBirth: yearsAgo(26, 5, 17), sport: 'Muay Thai', rankOrder: 6,  joinedMonthsAgo: 14 },

  // ── BJJ (10) ──────────────────────────────────────────────────────────────
  { name: 'Sofia Andrade',     email: 'sofia.andrade@ffc.demo',     phone: '11991230011', dateOfBirth: yearsAgo(23, 1, 12), sport: 'BJJ', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Guilherme Souza',   email: 'guilherme.souza@ffc.demo',   phone: '11991230012', dateOfBirth: yearsAgo(29, 10, 4), sport: 'BJJ', rankOrder: 2,  joinedMonthsAgo: 4  },
  { name: 'Patricia Luz',      email: 'patricia.luz@ffc.demo',      phone: '11991230013', dateOfBirth: yearsAgo(32, 3, 21), sport: 'BJJ', rankOrder: 5,  joinedMonthsAgo: 6,  overdue: true },
  { name: 'Ricardo Monteiro',  email: 'ricardo.monteiro@ffc.demo',  phone: '11991230014', dateOfBirth: yearsAgo(25, 7, 9),  sport: 'BJJ', rankOrder: 9,  joinedMonthsAgo: 10 },
  { name: 'Daniela Fonseca',   email: 'daniela.fonseca@ffc.demo',   phone: '11991230015', dateOfBirth: yearsAgo(27, 2, 28), sport: 'BJJ', rankOrder: 13, joinedMonthsAgo: 14 },
  { name: 'Vitor Hugo',        email: 'vitor.hugo@ffc.demo',        phone: '11991230016', dateOfBirth: yearsAgo(34, 9, 16), sport: 'BJJ', rankOrder: 14, joinedMonthsAgo: 20 },
  { name: 'Larissa Melo',      email: 'larissa.melo@ffc.demo',      phone: '11991230017', dateOfBirth: yearsAgo(38, 4, 7),  sport: 'BJJ', rankOrder: 15, joinedMonthsAgo: 28 },
  { name: 'Paulo Sérgio',      email: 'paulo.sergio@ffc.demo',      phone: '11991230018', dateOfBirth: yearsAgo(42, 12, 2), sport: 'BJJ', rankOrder: 16, joinedMonthsAgo: 42 },
  { name: 'Amanda Lopes',      email: 'amanda.lopes@ffc.demo',      phone: '11991230019', dateOfBirth: yearsAgo(21, 6, 30), sport: 'BJJ', rankOrder: 3,  joinedMonthsAgo: 5  },
  { name: 'Thiago Braga',      email: 'thiago.braga@ffc.demo',      phone: '11991230020', dateOfBirth: yearsAgo(30, 8, 11), sport: 'BJJ', rankOrder: 7,  joinedMonthsAgo: 9  },

  // ── Judô (8) ──────────────────────────────────────────────────────────────
  { name: 'Beatriz Cunha',     email: 'beatriz.cunha@ffc.demo',     phone: '11991230021', dateOfBirth: yearsAgo(22, 4, 18), sport: 'Judô', rankOrder: 0,  joinedMonthsAgo: 1  },
  { name: 'Gabriel Torres',    email: 'gabriel.torres@ffc.demo',    phone: '11991230022', dateOfBirth: yearsAgo(28, 7, 3),  sport: 'Judô', rankOrder: 1,  joinedMonthsAgo: 3  },
  { name: 'Anderson Rocha',    email: 'anderson.rocha@ffc.demo',    phone: '11991230023', dateOfBirth: yearsAgo(35, 2, 14), sport: 'Judô', rankOrder: 2,  joinedMonthsAgo: 5,  overdue: true },
  { name: 'Henrique Vieira',   email: 'henrique.vieira@ffc.demo',   phone: '11991230024', dateOfBirth: yearsAgo(26, 11, 22),sport: 'Judô', rankOrder: 4,  joinedMonthsAgo: 9  },
  { name: 'Melissa Rodrigues', email: 'melissa.rodrigues@ffc.demo', phone: '11991230025', dateOfBirth: yearsAgo(31, 5, 6),  sport: 'Judô', rankOrder: 6,  joinedMonthsAgo: 15 },
  { name: 'Roberto Cavalcante',email: 'roberto.cavalcante@ffc.demo',phone: '11991230026', dateOfBirth: yearsAgo(39, 9, 27), sport: 'Judô', rankOrder: 8,  joinedMonthsAgo: 22 },
  { name: 'Cristina Prado',    email: 'cristina.prado@ffc.demo',    phone: '11991230027', dateOfBirth: yearsAgo(33, 3, 15), sport: 'Judô', rankOrder: 9,  joinedMonthsAgo: 30 },
  { name: 'Natalia Barbosa',   email: 'natalia.barbosa@ffc.demo',   phone: '11991230028', dateOfBirth: yearsAgo(24, 1, 8),  sport: 'Judô', rankOrder: 3,  joinedMonthsAgo: 7  },
];

// Dias de treino por modalidade (0=Dom, 1=Seg … 6=Sáb)
const CLASS_DAYS: Record<string, Set<number>> = {
  'Muay Thai': new Set([1, 4]),       // Seg + Qui
  'BJJ':       new Set([1, 3, 6]),    // Seg + Qua + Sáb
  'Judô':      new Set([2, 5]),       // Ter + Sex
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Restauração completa do banco de dados — FightFlowCore\n');

  // 1. Planos
  let betaPlano = (await db.select().from(planos).where(eq(planos.nome, 'Beta Gratuito')))[0];
  if (!betaPlano) {
    const planosData = [
      { nome: 'Beta Gratuito', limiteAlunos: 10,  precoMensal: 0,     ativo: true },
      { nome: 'Básico',        limiteAlunos: 50,  precoMensal: 4900,  ativo: true },
      { nome: 'Profissional',  limiteAlunos: 200, precoMensal: 9900,  ativo: true },
      { nome: 'Enterprise',    limiteAlunos: 500, precoMensal: 19900, ativo: true },
    ];
    const inserted = await db.insert(planos).values(planosData).returning();
    betaPlano = inserted.find(p => p.nome === 'Beta Gratuito')!;
    console.log('✅ Planos de plataforma criados (4)');
  } else {
    console.log('⚠️  Planos já existem, usando Beta Gratuito');
  }

  // 2. Academia
  let academy = (await db.select().from(academies).where(eq(academies.slug, 'anjo')))[0];
  if (!academy) {
    [academy] = await db.insert(academies).values({
      name: 'Fight Club App',
      slug: 'anjo',
      email: 'mvoli@gmail.com',
      phone: '11999990000',
      description: 'Academia de artes marciais',
    }).returning();
    console.log(`✅ Academia criada: ${academy.name} (slug: anjo)`);
  } else {
    console.log(`⚠️  Academia já existe: ${academy.name}`);
  }

  // Guarda anti-empilhamento: este seed usa o elenco @ffc.demo; se a academia já
  // foi povoada por outro seed demo (@demo.com), rodar os dois duplica a base de
  // alunos com "quase-clones" (João Victor Pires / João Pires etc.).
  const demoComStudents = await db.select({ id: users.id }).from(users)
    .where(and(
      eq(users.academyId, academy.id),
      eq(users.role, 'ALUNO'),
      sql`${users.email} LIKE '%@demo.com'`,
    ));
  if (demoComStudents.length > 0) {
    console.error(`❌ A academia já tem ${demoComStudents.length} aluno(s) demo de outro seed (@demo.com).`);
    console.error('   Rodar este seed por cima duplicaria a base de alunos.');
    console.error('   Para repovoar do zero sem duplicados: npm run seed:demo:reset');
    process.exit(1);
  }

  // 3. Assinatura
  const existingAssinatura = await db.select().from(assinaturas)
    .where(eq(assinaturas.academiaId, academy.id));
  if (existingAssinatura.length === 0) {
    await db.insert(assinaturas).values({
      academiaId: academy.id,
      planoId: betaPlano.id,
      dataInicio: new Date(),
      status: 'teste',
    });
    console.log('✅ Assinatura criada: Beta Gratuito (teste)');
  } else {
    console.log('⚠️  Assinatura já existe');
  }

  // 4. Admin
  const pw = await bcrypt.hash('Senha@123', 10);

  let admin = (await db.select().from(users)
    .where(eq(users.email, 'mvoli@gmail.com')))[0];
  if (!admin) {
    [admin] = await db.insert(users).values({
      email: 'mvoli@gmail.com',
      password: pw,
      name: 'João',
      role: 'ADMIN_ACADEMIA',
      academyId: academy.id,
      active: true,
      firstAccess: false,
    }).returning();
    console.log(`✅ Admin criado: ${admin.name} (${admin.email})`);
  } else {
    // Sempre reseta a senha e garante que o admin está vinculado à academia correta
    [admin] = await db.update(users)
      .set({ password: pw, academyId: academy.id, active: true, firstAccess: false })
      .where(eq(users.email, 'mvoli@gmail.com'))
      .returning();
    console.log(`♻️  Admin atualizado: ${admin.name} (senha resetada para Senha@123)`);
  }

  // 5. Professor
  let professor = (await db.select().from(users)
    .where(and(eq(users.academyId, academy.id), eq(users.role, 'PROFESSOR'))))[0];
  if (!professor) {
    [professor] = await db.insert(users).values({
      email: 'professor.silva@ffc.demo',
      password: pw,
      name: 'Professor Silva',
      role: 'PROFESSOR',
      academyId: academy.id,
      belt: 'preta',
      active: true,
      firstAccess: false,
    }).returning();
    console.log('✅ Professor criado: Professor Silva (faixa preta)');
  } else {
    console.log(`⚠️  Professor já existe: ${professor.name}`);
  }

  // 6. Plano de mensalidade da academia
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
    console.log('✅ Plano de mensalidade: Mensal Padrão (R$ 150,00/mês)');
  } else {
    console.log(`⚠️  Plano de mensalidade já existe: ${plan.name}`);
  }

  console.log('');

  // 7. Modalidades (classTypes) + turmas
  const classTypeMap = new Map<string, string>();  // sport → ctId
  const classMap     = new Map<string, string>();  // sport → classId

  const SCHEDULES: Record<string, { days: number[]; start: string; end: string }> = {
    'Muay Thai': { days: [1, 4],    start: '19:00', end: '20:30' },
    'BJJ':       { days: [1, 3, 6], start: '20:00', end: '21:30' },
    'Judô':      { days: [2, 5],    start: '18:00', end: '19:30' },
  };

  for (const sys of GRADUATION_SYSTEMS) {
    // classType
    let ct = (await db.select().from(classTypes)
      .where(and(eq(classTypes.academyId, academy.id), eq(classTypes.name, sys.sport))))[0];
    if (!ct) {
      [ct] = await db.insert(classTypes).values({
        academyId: academy.id,
        name: sys.sport,
        description: `${sys.sport} — ${sys.systemName}`,
        duration: 90,
        maxCapacity: 25,
        active: true,
      }).returning();
      console.log(`✅ Modalidade criada: ${sys.sport}`);
    } else {
      if (!ct.active) {
        await db.update(classTypes).set({ active: true }).where(eq(classTypes.id, ct.id));
        console.log(`♻️  Modalidade reativada: ${sys.sport}`);
      } else {
        console.log(`⚠️  Modalidade já existe: ${sys.sport}`);
      }
    }
    classTypeMap.set(sys.sport, ct.id);

    // classes (turmas) — 1 por modalidade (primeira da grade)
    const sched = SCHEDULES[sys.sport];
    let cls = (await db.select().from(classes)
      .where(and(
        eq(classes.academyId, academy.id),
        eq(classes.classTypeId, ct.id),
        eq(classes.active, true),
      )))[0];
    if (!cls) {
      [cls] = await db.insert(classes).values({
        academyId: academy.id,
        classTypeId: ct.id,
        instructorId: professor.id,
        dayOfWeek: sched.days[0],
        startTime: sched.start,
        endTime: sched.end,
        active: true,
      }).returning();
      console.log(`   └─ Turma criada: ${sys.sport} dia ${sched.days[0]} ${sched.start}`);
    }
    classMap.set(sys.sport, cls.id);
  }

  console.log('');

  // 8. Sistemas de graduação + ranks
  const rankIdBySportAndOrder = new Map<string, Map<number, string>>();

  for (const sysDef of GRADUATION_SYSTEMS) {
    const ctId = classTypeMap.get(sysDef.sport)!;

    let sysId: string;
    const existing = (await db.select().from(graduationSystems)
      .where(and(
        eq(graduationSystems.academyId, academy.id),
        eq(graduationSystems.classTypeId, ctId),
      )))[0];

    if (existing) {
      sysId = existing.id;
      console.log(`⚠️  Sistema já existe: ${sysDef.systemName}`);
    } else {
      const [created] = await db.insert(graduationSystems).values({
        academyId: academy.id,
        classTypeId: ctId,
        name: sysDef.systemName,
      }).returning();
      sysId = created.id;
      console.log(`✅ Sistema criado: ${sysDef.systemName}`);
    }

    const existingRanks = await db.select().from(graduationRanks)
      .where(eq(graduationRanks.systemId, sysId));

    const orderMap = new Map<number, string>();
    for (const r of existingRanks) orderMap.set(r.displayOrder, r.id);

    let inserted = 0;
    for (const rd of sysDef.ranks) {
      if (!orderMap.has(rd.displayOrder)) {
        const [r] = await db.insert(graduationRanks).values({
          systemId: sysId,
          name: rd.name,
          displayOrder: rd.displayOrder,
          colorClass: rd.colorClass,
        }).returning();
        orderMap.set(rd.displayOrder, r.id);
        inserted++;
      }
    }
    if (inserted > 0) console.log(`   └─ ${inserted} graduações inseridas`);

    rankIdBySportAndOrder.set(sysDef.sport, orderMap);
  }

  console.log('');

  // 9. Alunos, matrículas, ranks, pagamentos, presença
  const studentPw = await bcrypt.hash('Senha@123', 10);

  for (const s of STUDENTS) {
    const joinDate = monthsAgo(s.joinedMonthsAgo, 5);
    const ctId = classTypeMap.get(s.sport)!;
    const classId = classMap.get(s.sport)!;
    const rankMap = rankIdBySportAndOrder.get(s.sport)!;
    const rankId = rankMap.get(s.rankOrder);

    if (!rankId) {
      console.warn(`⚠️  Rank ${s.rankOrder} não encontrado para ${s.sport}, pulando ${s.name}`);
      continue;
    }

    // Aluno
    let studentId: string;
    const existing = (await db.select({ id: users.id }).from(users)
      .where(eq(users.email, s.email)))[0];

    if (existing) {
      studentId = existing.id;
    } else {
      const [student] = await db.insert(users).values({
        email: s.email,
        password: studentPw,
        name: s.name,
        phone: s.phone,
        dateOfBirth: s.dateOfBirth,
        role: 'ALUNO',
        academyId: academy.id,
        belt: 'branca',
        active: true,
        firstAccess: false,
        createdAt: joinDate,
      }).returning();
      studentId = student.id;
    }

    // Matrícula na modalidade
    const existingEnroll = (await db.select({ id: studentModalityEnrollments.id })
      .from(studentModalityEnrollments)
      .where(and(
        eq(studentModalityEnrollments.studentId, studentId),
        eq(studentModalityEnrollments.classTypeId, ctId),
      )))[0];

    if (!existingEnroll) {
      await db.insert(studentModalityEnrollments).values({
        studentId,
        academyId: academy.id,
        classTypeId: ctId,
        enrolledAt: joinDate,
        active: true,
      });
    }

    // Rank atual
    const existingRank = (await db.select({ id: studentModalityRanks.id })
      .from(studentModalityRanks)
      .where(and(
        eq(studentModalityRanks.studentId, studentId),
        eq(studentModalityRanks.classTypeId, ctId),
      )))[0];

    const promotedAt = monthsAgo(Math.max(s.joinedMonthsAgo - 1, 0), 15);

    if (!existingRank) {
      await db.insert(studentModalityRanks).values({
        studentId,
        academyId: academy.id,
        classTypeId: ctId,
        rankId,
        promotedAt,
        promotedBy: admin.id,
      });

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
          notes: 'Graduação registrada via seed de restauração',
        });
      }
    }

    // Belt history (campo legacy na tabela users)
    const sysDef = GRADUATION_SYSTEMS.find(x => x.sport === s.sport)!;
    const rankName = sysDef.ranks[s.rankOrder]?.name ?? 'Branca';
    const beltValue = rankName.toLowerCase().split(' ')[0]; // ex: 'azul', 'amarela'

    if (beltValue !== 'branca') {
      const existingBelt = (await db.select({ id: beltHistory.id })
        .from(beltHistory)
        .where(and(
          eq(beltHistory.studentId, studentId),
          eq(beltHistory.academyId, academy.id),
        )))[0];

      if (!existingBelt) {
        await db.insert(beltHistory).values({
          studentId,
          academyId: academy.id,
          beltBefore: 'branca',
          beltAfter: beltValue,
          promotedBy: admin.id,
          promotedAt,
          notes: 'Graduação registrada via seed de restauração',
        });
      }
    }

    // Pagamentos (um por mês desde a entrada)
    const existingPayment = (await db.select({ id: payments.id })
      .from(payments)
      .where(and(
        eq(payments.studentId, studentId),
        eq(payments.academyId, academy.id),
      )))[0];

    if (!existingPayment) {
      const payRows = [];
      for (let m = s.joinedMonthsAgo; m >= 0; m--) {
        const dueDate = monthsAgo(m, 5);
        let status: string;
        let paidDate: Date | undefined;

        if (s.overdue && m <= 1) {
          status = 'overdue';
        } else if (m === 0) {
          status = Math.random() < 0.65 ? 'paid' : 'pending';
          if (status === 'paid') {
            paidDate = new Date(dueDate);
            paidDate.setDate(paidDate.getDate() + 2);
          }
        } else {
          status = 'paid';
          paidDate = new Date(dueDate);
          paidDate.setDate(paidDate.getDate() + Math.ceil(Math.random() * 4));
        }

        payRows.push({
          studentId,
          academyId: academy.id,
          membershipPlanId: plan.id,
          amount: plan.price,
          dueDate,
          ...(paidDate ? { paidDate } : {}),
          status,
        });
      }
      await db.insert(payments).values(payRows);
    }

    // Presença — últimos 30 dias, ~75% nos dias da modalidade
    const existingAttendance = (await db.select({ id: attendance.id })
      .from(attendance)
      .where(and(
        eq(attendance.studentId, studentId),
        eq(attendance.academyId, academy.id),
      )))[0];

    if (!existingAttendance) {
      const trainingDays = CLASS_DAYS[s.sport];
      const attRows = [];
      for (let d = 29; d >= 0; d--) {
        const date = daysAgo(d);
        if (!trainingDays.has(date.getDay())) continue;
        if (date < joinDate) continue;
        const present = Math.random() < 0.75;
        attRows.push({
          studentId,
          classId,
          academyId: academy.id,
          date,
          present,
          status: present ? 'presente' : 'falta',
        });
      }
      if (attRows.length > 0) await db.insert(attendance).values(attRows);
    }

    const sysSport = s.sport.padEnd(9);
    const overdueTag = s.overdue ? ' ⚠️  inadimplente' : '';
    const skip = existing ? '(já existia) ' : '';
    console.log(`✅ ${s.name.padEnd(24)} [${sysSport}] ${rankName}${overdueTag} ${skip}`);
  }

  console.log('\n🎉 Restauração concluída!');
  console.log('');
  console.log('   Admin:     mvoli@gmail.com  /  Senha@123');
  console.log('   Professor: professor.silva@ffc.demo  /  Senha@123');
  console.log('   Alunos:    Senha@123 (todos os 28)');
  console.log('   Academia:  slug = anjo');
}

main()
  .catch(err => { console.error('\n💥 Erro na restauração:', err); process.exit(1); })
  .finally(() => pool.end());
