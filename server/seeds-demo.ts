// Populates realistic demo data for an existing academy (slug: 'anjo').
// Safe to run multiple times — skips already-existing records.
// All demo student passwords: Senha@123

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';
import {
  academies, users, membershipPlans, classTypes, classes,
  payments, attendance, beltHistory,
} from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

// ─── Date helpers ────────────────────────────────────────────────────────────

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

// ─── Demo data ───────────────────────────────────────────────────────────────

const OVERDUE_EMAILS = new Set([
  'carlos.mendes@demo.com',
  'rafael.oliveira@demo.com',
  'diego.martins@demo.com',
]);

type Modality = 'bjj' | 'karate';

interface DemoStudent {
  name: string;
  email: string;
  belt: string;
  joined: { months: number; day: number };
  modality: Modality;
}

const DEMO_STUDENTS: DemoStudent[] = [
  // ── BJJ ──────────────────────────────────────────────────────────────────
  { name: 'Ana Souza',           email: 'ana.souza@demo.com',            belt: 'cinza',   joined: { months: 5,  day: 5  }, modality: 'bjj' },
  { name: 'Carlos Mendes',       email: 'carlos.mendes@demo.com',        belt: 'branca',  joined: { months: 5,  day: 12 }, modality: 'bjj' },
  { name: 'Fernanda Lima',       email: 'fernanda.lima@demo.com',        belt: 'amarela', joined: { months: 4,  day: 8  }, modality: 'bjj' },
  { name: 'Rafael Oliveira',     email: 'rafael.oliveira@demo.com',      belt: 'branca',  joined: { months: 4,  day: 20 }, modality: 'bjj' },
  { name: 'Juliana Costa',       email: 'juliana.costa@demo.com',        belt: 'verde',   joined: { months: 3,  day: 3  }, modality: 'bjj' },
  { name: 'Bruno Santos',        email: 'bruno.santos@demo.com',         belt: 'branca',  joined: { months: 3,  day: 15 }, modality: 'bjj' },
  { name: 'Mariana Reis',        email: 'mariana.reis@demo.com',         belt: 'azul',    joined: { months: 3,  day: 25 }, modality: 'bjj' },
  { name: 'Lucas Ferreira',      email: 'lucas.ferreira@demo.com',       belt: 'branca',  joined: { months: 2,  day: 6  }, modality: 'bjj' },
  { name: 'Patricia Alves',      email: 'patricia.alves@demo.com',       belt: 'amarela', joined: { months: 2,  day: 18 }, modality: 'bjj' },
  { name: 'Rodrigo Nascimento',  email: 'rodrigo.nascimento@demo.com',   belt: 'branca',  joined: { months: 1,  day: 4  }, modality: 'bjj' },
  { name: 'Camila Moreira',      email: 'camila.moreira@demo.com',       belt: 'roxa',    joined: { months: 1,  day: 22 }, modality: 'bjj' },
  { name: 'Thiago Ribeiro',      email: 'thiago.ribeiro@demo.com',       belt: 'branca',  joined: { months: 0,  day: 3  }, modality: 'bjj' },
  { name: 'Isabela Carvalho',    email: 'isabela.carvalho@demo.com',     belt: 'branca',  joined: { months: 0,  day: 10 }, modality: 'bjj' },
  // novos BJJ
  { name: 'Pedro Gomes',         email: 'pedro.gomes@demo.com',          belt: 'preta',   joined: { months: 12, day: 3  }, modality: 'bjj' },
  { name: 'Larissa Teixeira',    email: 'larissa.teixeira@demo.com',     belt: 'amarela', joined: { months: 5,  day: 14 }, modality: 'bjj' },
  { name: 'Felipe Barros',       email: 'felipe.barros@demo.com',        belt: 'branca',  joined: { months: 2,  day: 22 }, modality: 'bjj' },
  { name: 'Natalia Pereira',     email: 'natalia.pereira@demo.com',      belt: 'verde',   joined: { months: 7,  day: 9  }, modality: 'bjj' },
  { name: 'Diego Martins',       email: 'diego.martins@demo.com',        belt: 'branca',  joined: { months: 1,  day: 17 }, modality: 'bjj' },

  // ── Karatê ───────────────────────────────────────────────────────────────
  { name: 'Sofia Yamamoto',      email: 'sofia.yamamoto@demo.com',       belt: 'amarela', joined: { months: 5,  day: 7  }, modality: 'karate' },
  { name: 'Eduardo Costa',       email: 'eduardo.costa@demo.com',        belt: 'branca',  joined: { months: 3,  day: 11 }, modality: 'karate' },
  { name: 'Amanda Ferreira',     email: 'amanda.ferreira@demo.com',      belt: 'verde',   joined: { months: 6,  day: 2  }, modality: 'karate' },
  { name: 'Gustavo Lima',        email: 'gustavo.lima@demo.com',         belt: 'azul',    joined: { months: 8,  day: 19 }, modality: 'karate' },
  { name: 'Letícia Santos',      email: 'leticia.santos@demo.com',       belt: 'branca',  joined: { months: 1,  day: 28 }, modality: 'karate' },
  { name: 'Paulo Machado',       email: 'paulo.machado@demo.com',        belt: 'amarela', joined: { months: 4,  day: 6  }, modality: 'karate' },
  { name: 'Rebeca Alves',        email: 'rebeca.alves@demo.com',         belt: 'branca',  joined: { months: 0,  day: 8  }, modality: 'karate' },
  { name: 'Roberto Azevedo',     email: 'roberto.azevedo@demo.com',      belt: 'marrom',  joined: { months: 10, day: 14 }, modality: 'karate' },
  { name: 'Vanessa Correia',     email: 'vanessa.correia@demo.com',      belt: 'amarela', joined: { months: 3,  day: 23 }, modality: 'karate' },
  { name: 'Henrique Duarte',     email: 'henrique.duarte@demo.com',      belt: 'branca',  joined: { months: 2,  day: 5  }, modality: 'karate' },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Iniciando seed de dados demo...\n');

  // 1. Academy
  const [academy] = await db.select().from(academies).where(eq(academies.slug, 'anjo'));
  if (!academy) {
    console.error('❌ Academia com slug "anjo" não encontrada. Crie a academia via app primeiro.');
    process.exit(1);
  }
  console.log(`✅ Academia: ${academy.name} (${academy.id})`);

  // 2. Admin
  const [admin] = await db.select().from(users)
    .where(and(eq(users.academyId, academy.id), eq(users.role, 'ADMIN_ACADEMIA')));
  if (!admin) {
    console.error('❌ Nenhum ADMIN_ACADEMIA encontrado para essa academia.');
    process.exit(1);
  }
  console.log(`✅ Admin: ${admin.name} (${admin.email})\n`);

  // 3. Professor
  let professor = (await db.select().from(users)
    .where(and(eq(users.academyId, academy.id), eq(users.role, 'PROFESSOR'))))[0];
  if (!professor) {
    const pw = await bcrypt.hash('Senha@123', 10);
    [professor] = await db.insert(users).values({
      email: 'professor.silva@demo.com',
      password: pw,
      name: 'Professor Silva',
      role: 'PROFESSOR',
      academyId: academy.id,
      belt: 'preta',
      active: true,
      firstAccess: false,
    }).returning();
    console.log('✅ Professor Silva criado (faixa preta)');
  } else {
    console.log(`⚠️  Professor já existe: ${professor.name}`);
  }

  // 4. Membership plan
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
  } else {
    console.log(`⚠️  Plano já existe: ${plan.name}`);
  }

  // 5a. BJJ class type + class
  let bjjClassType = (await db.select().from(classTypes)
    .where(and(
      eq(classTypes.academyId, academy.id),
      eq(classTypes.active, true),
      sql`LOWER(${classTypes.name}) LIKE '%bjj%'`,
    )))[0];
  if (!bjjClassType) {
    [bjjClassType] = await db.insert(classTypes).values({
      academyId: academy.id,
      name: 'BJJ',
      description: 'Brazilian Jiu-Jitsu',
      duration: 90,
      maxCapacity: 20,
      active: true,
    }).returning();
    console.log('✅ Modalidade criada: BJJ');
  } else {
    console.log(`⚠️  Modalidade BJJ já existe: ${bjjClassType.name}`);
  }

  let bjjClass = (await db.select().from(classes)
    .where(and(
      eq(classes.academyId, academy.id),
      eq(classes.active, true),
      eq(classes.classTypeId, bjjClassType.id),
    )))[0];
  if (!bjjClass) {
    [bjjClass] = await db.insert(classes).values({
      academyId: academy.id,
      classTypeId: bjjClassType.id,
      instructorId: professor.id,
      dayOfWeek: 1,
      startTime: '19:00',
      endTime: '20:30',
      active: true,
    }).returning();
    console.log('✅ Turma criada: BJJ — segunda-feira 19h');
  } else {
    console.log(`⚠️  Turma BJJ já existe`);
  }

  // 5b. Karatê class type + class
  let karateClassType = (await db.select().from(classTypes)
    .where(and(
      eq(classTypes.academyId, academy.id),
      eq(classTypes.active, true),
      sql`LOWER(${classTypes.name}) LIKE '%karat%'`,
    )))[0];
  if (!karateClassType) {
    [karateClassType] = await db.insert(classTypes).values({
      academyId: academy.id,
      name: 'Karatê',
      description: 'Karatê Shotokan',
      duration: 60,
      maxCapacity: 25,
      active: true,
    }).returning();
    console.log('✅ Modalidade criada: Karatê');
  } else {
    console.log(`⚠️  Modalidade Karatê já existe: ${karateClassType.name}`);
  }

  let karateClass = (await db.select().from(classes)
    .where(and(
      eq(classes.academyId, academy.id),
      eq(classes.active, true),
      eq(classes.classTypeId, karateClassType.id),
    )))[0];
  if (!karateClass) {
    [karateClass] = await db.insert(classes).values({
      academyId: academy.id,
      classTypeId: karateClassType.id,
      instructorId: professor.id,
      dayOfWeek: 2,
      startTime: '18:00',
      endTime: '19:00',
      active: true,
    }).returning();
    console.log('✅ Turma criada: Karatê — terça-feira 18h');
  } else {
    console.log(`⚠️  Turma Karatê já existe`);
  }

  console.log('');

  // Dias de treino por modalidade
  const CLASS_DAYS: Record<Modality, Set<number>> = {
    bjj:    new Set([1, 3, 5]), // Seg/Qua/Sex
    karate: new Set([2, 4, 6]), // Ter/Qui/Sáb
  };
  const modalityClass: Record<Modality, typeof bjjClass> = {
    bjj:    bjjClass,
    karate: karateClass,
  };

  // 6. Students, payments, belt history, attendance
  const password = await bcrypt.hash('Senha@123', 10);

  for (const s of DEMO_STUDENTS) {
    const existing = (await db.select({ id: users.id }).from(users)
      .where(eq(users.email, s.email)))[0];
    if (existing) {
      console.log(`⚠️  ${s.name} já existe, pulando`);
      continue;
    }

    const joinDate = monthsAgo(s.joined.months, s.joined.day);

    const [student] = await db.insert(users).values({
      email: s.email,
      password,
      name: s.name,
      role: 'ALUNO',
      academyId: academy.id,
      belt: s.belt,
      active: true,
      firstAccess: false,
      createdAt: joinDate,
    }).returning();

    // Payments — one per month from join month to current month
    const isOverdue = OVERDUE_EMAILS.has(s.email);
    const paymentRows = [];

    for (let m = s.joined.months; m >= 0; m--) {
      const dueDate = monthsAgo(m, 5);

      let status: string;
      let paidDate: Date | undefined;

      if (isOverdue && m <= 1) {
        status = 'overdue';
      } else if (m === 0) {
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
    await db.insert(payments).values(paymentRows);

    // Belt history for non-branca belts
    if (s.belt !== 'branca') {
      await db.insert(beltHistory).values({
        studentId: student.id,
        academyId: academy.id,
        beltBefore: 'branca',
        beltAfter: s.belt,
        promotedBy: admin.id,
        promotedAt: monthsAgo(Math.max(s.joined.months - 1, 0), 15),
        notes: 'Graduação registrada via seed de demonstração',
      });
    }

    // Attendance — last 30 days on modality's training days, ~75% presence
    const classDays = CLASS_DAYS[s.modality];
    const targetClass = modalityClass[s.modality];
    const attendanceRows = [];

    for (let d = 29; d >= 0; d--) {
      const date = daysAgo(d);
      if (!classDays.has(date.getDay())) continue;
      if (date < joinDate) continue;
      const present = Math.random() < 0.75;
      attendanceRows.push({
        studentId: student.id,
        classId: targetClass.id,
        academyId: academy.id,
        date,
        present,
        status: present ? 'presente' : 'falta',
      });
    }
    if (attendanceRows.length > 0) {
      await db.insert(attendance).values(attendanceRows);
    }

    const months = s.joined.months + 1;
    const tag = isOverdue ? ' ⚠️  inadimplente' : '';
    const mod = s.modality === 'karate' ? '🥋 Karatê' : '🟦 BJJ   ';
    console.log(`✅ ${s.name.padEnd(22)} ${mod}  faixa ${s.belt.padEnd(7)} ${months} mês(es)${tag}`);
  }

  console.log('\n🎉 Seed demo concluído!');
  console.log('   Abra o dashboard para ver os dados.');
  console.log('   Senha de todos os alunos demo: Senha@123');
}

main()
  .catch(err => { console.error('\n💥 Erro no seed:', err); process.exit(1); })
  .finally(() => pool.end());
