// Motor de cobrança recorrente: na virada do mês gera a mensalidade pendente de
// cada aluno ativo (idempotente — roda a cada hora com catch-up; nunca duplica
// dentro do mês) e dispara o lembrete de vencimento D-N por e-mail.

import { and, eq, gte, lt, isNull, inArray, desc } from "drizzle-orm";
import { db } from "../db";
import { users, academies, enrollments, membershipPlans, payments } from "@shared/schema";
import { log } from "../vite";
import {
  monthStart, nextMonthStart, buildMonthlyCharges, shouldRemind, reminderEmail,
  type ChargeCandidate,
} from "../lib/recurring";
import { sendMail, isMailerConfigured } from "../lib/mailer";

const INTERVAL_MS = 60 * 60 * 1000; // 1 hora — a idempotência garante gerar 1x por mês

export async function generateMonthlyPayments(now: Date = new Date()): Promise<number> {
  const start = monthStart(now);
  const end = nextMonthStart(now);

  const students = await db
    .select({
      id: users.id,
      academyId: users.academyId,
      createdAt: users.createdAt,
      customMonthlyAmount: users.customMonthlyAmount,
    })
    .from(users)
    .where(and(eq(users.role, 'ALUNO'), eq(users.active, true)));

  const activeStudents = students.filter(s => s.academyId);
  if (activeStudents.length === 0) return 0;

  // Idempotência: quem já tem pagamento (qualquer status) com vencimento neste mês
  const existing = await db
    .select({ studentId: payments.studentId })
    .from(payments)
    .where(and(gte(payments.dueDate, start), lt(payments.dueDate, end)));
  const alreadyCharged = new Set(existing.map(r => r.studentId));

  // Plano por aluno: matrícula ativa em turma mais recente...
  const enrollRows = await db
    .select({ studentId: enrollments.studentId, planId: enrollments.membershipPlanId })
    .from(enrollments)
    .where(eq(enrollments.active, true))
    .orderBy(desc(enrollments.createdAt));
  const planByStudent = new Map<string, string>();
  for (const row of enrollRows) {
    if (!planByStudent.has(row.studentId)) planByStudent.set(row.studentId, row.planId);
  }

  // ...ou, na falta (bases anteriores à UI de matrícula), o plano da última mensalidade
  const withoutPlan = activeStudents.filter(s => !planByStudent.has(s.id)).map(s => s.id);
  if (withoutPlan.length > 0) {
    const lastPayments = await db
      .select({ studentId: payments.studentId, planId: payments.membershipPlanId })
      .from(payments)
      .where(inArray(payments.studentId, withoutPlan))
      .orderBy(desc(payments.dueDate));
    for (const row of lastPayments) {
      if (!planByStudent.has(row.studentId)) planByStudent.set(row.studentId, row.planId);
    }
  }

  const planIds = Array.from(new Set(planByStudent.values()));
  const priceByPlan = new Map<string, number>();
  if (planIds.length > 0) {
    const plans = await db
      .select({ id: membershipPlans.id, price: membershipPlans.price })
      .from(membershipPlans)
      .where(inArray(membershipPlans.id, planIds));
    for (const p of plans) priceByPlan.set(p.id, p.price);
  }

  const academyRows = await db
    .select({ id: academies.id, dueDay: academies.paymentDueDay })
    .from(academies);
  const dueDayByAcademy = new Map(academyRows.map(a => [a.id, a.dueDay]));

  const candidates: ChargeCandidate[] = activeStudents.map(s => {
    const planId = planByStudent.get(s.id) ?? null;
    return {
      studentId: s.id,
      academyId: s.academyId!,
      createdAt: s.createdAt ?? new Date(0),
      customMonthlyAmount: s.customMonthlyAmount,
      planId,
      planPrice: planId ? priceByPlan.get(planId) ?? null : null,
      hasPaymentThisMonth: alreadyCharged.has(s.id),
    };
  });

  const charges = buildMonthlyCharges(candidates, now, dueDayByAcademy);
  if (charges.length === 0) return 0;

  await db.insert(payments).values(charges);
  return charges.length;
}

export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const daysBefore = parseInt(process.env.PAYMENT_REMINDER_DAYS_BEFORE ?? '3', 10);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + daysBefore + 1);

  const rows = await db
    .select({
      paymentId: payments.id,
      dueDate: payments.dueDate,
      amount: payments.amount,
      studentName: users.name,
      studentEmail: users.email,
      planName: membershipPlans.name,
      academyName: academies.name,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.studentId))
    .innerJoin(membershipPlans, eq(membershipPlans.id, payments.membershipPlanId))
    .innerJoin(academies, eq(academies.id, payments.academyId))
    .where(and(
      eq(payments.status, 'pending'),
      isNull(payments.reminderSentAt),
      lt(payments.dueDate, horizon),
    ));

  let sent = 0;
  for (const r of rows) {
    if (!shouldRemind({ status: 'pending', reminderSentAt: null, dueDate: r.dueDate }, now, daysBefore)) {
      continue; // já vencida — atraso é tratado pelo markOverduePayments, não por lembrete
    }
    const content = reminderEmail({
      studentName: r.studentName,
      planName: r.planName,
      academyName: r.academyName,
      amount: r.amount,
      dueDate: r.dueDate,
    });
    await sendMail({ to: r.studentEmail, subject: content.subject, text: content.text });
    // Marcado mesmo em modo log (sem SMTP) para não repetir a cada hora.
    await db.update(payments).set({ reminderSentAt: now }).where(eq(payments.id, r.paymentId));
    sent++;
  }
  return sent;
}

export function startRecurringBillingJob(): void {
  const run = async () => {
    try {
      const created = await generateMonthlyPayments();
      if (created > 0) log(`[billing-job] ${created} mensalidade(s) gerada(s) para o mês corrente`);
      const reminded = await sendDueReminders();
      if (reminded > 0) {
        const mode = isMailerConfigured() ? 'enviado(s) por e-mail' : 'registrado(s) em log (SMTP não configurado)';
        log(`[billing-job] ${reminded} lembrete(s) de vencimento ${mode}`);
      }
    } catch (err) {
      console.error('[billing-job] erro:', err);
    }
  };

  run(); // executa imediatamente no boot (catch-up se o servidor estava fora do ar na virada)
  setInterval(run, INTERVAL_MS);
}
