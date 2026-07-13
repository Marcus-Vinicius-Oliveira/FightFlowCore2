// Motor de cobrança recorrente: na virada do mês gera a mensalidade pendente de
// cada aluno ativo (idempotente — roda a cada hora com catch-up; nunca duplica
// dentro do mês) e dispara o lembrete de vencimento D-N por e-mail e WhatsApp.

import { and, eq, gte, lt, isNull, inArray, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { users, academies, enrollments, membershipPlans, payments } from "@shared/schema";
import { normalizePhoneBR, whatsappReminderText } from "@shared/whatsapp";
import { log } from "../vite";
import {
  monthStart, nextMonthStart, buildMonthlyCharges, shouldRemind, reminderEmail,
  formatBRL, formatDateBR,
  type ChargeCandidate,
} from "../lib/recurring";
import { sendMail, isMailerConfigured } from "../lib/mailer";
import { sendWhatsAppTemplate, isWhatsAppConfigured } from "../lib/whatsapp";

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
      paymentDueDay: users.paymentDueDay,
    })
    .from(users)
    .where(and(eq(users.role, 'ALUNO'), eq(users.active, true)));

  const activeStudents = students.filter(s => s.academyId);
  if (activeStudents.length === 0) return 0;

  // Idempotência por aluno+plano: quais planos já têm pagamento (qualquer status)
  // com vencimento neste mês. Cobra-se por modalidade, então a chave é o par.
  const existing = await db
    .select({ studentId: payments.studentId, planId: payments.membershipPlanId })
    .from(payments)
    .where(and(gte(payments.dueDate, start), lt(payments.dueDate, end)));
  const chargedPlansByStudent = new Map<string, Set<string>>();
  for (const r of existing) {
    let set = chargedPlansByStudent.get(r.studentId);
    if (!set) chargedPlansByStudent.set(r.studentId, (set = new Set()));
    set.add(r.planId);
  }

  // Âncora da regra dos 15 dias: vencimento mais recente por (aluno, plano),
  // considerando todo o histórico (a 1ª mensalidade nasce na matrícula).
  const anchorRows = await db
    .select({
      studentId: payments.studentId,
      planId: payments.membershipPlanId,
      lastDueDate: sql`max(${payments.dueDate})`.mapWith(payments.dueDate),
    })
    .from(payments)
    .groupBy(payments.studentId, payments.membershipPlanId);
  const lastDueByStudentPlan = new Map<string, Date>();
  for (const r of anchorRows) {
    if (r.lastDueDate) lastDueByStudentPlan.set(`${r.studentId}|${r.planId}`, r.lastDueDate);
  }

  // Planos por aluno: um por modalidade, distintos, das matrículas ativas.
  // (As várias linhas por-dia de uma mesma turma compartilham o plano → 1 cobrança.)
  const enrollRows = await db
    .select({ studentId: enrollments.studentId, planId: enrollments.membershipPlanId })
    .from(enrollments)
    .where(eq(enrollments.active, true));
  const plansByStudent = new Map<string, Set<string>>();
  for (const row of enrollRows) {
    let set = plansByStudent.get(row.studentId);
    if (!set) plansByStudent.set(row.studentId, (set = new Set()));
    set.add(row.planId);
  }

  // Fallback (bases anteriores à UI de matrícula): aluno sem matrícula ativa
  // usa o plano da última mensalidade — uma cobrança só.
  const withoutPlan = activeStudents.filter(s => !plansByStudent.has(s.id)).map(s => s.id);
  if (withoutPlan.length > 0) {
    const lastPayments = await db
      .select({ studentId: payments.studentId, planId: payments.membershipPlanId })
      .from(payments)
      .where(inArray(payments.studentId, withoutPlan))
      .orderBy(desc(payments.dueDate));
    for (const row of lastPayments) {
      if (!plansByStudent.has(row.studentId)) plansByStudent.set(row.studentId, new Set([row.planId]));
    }
  }

  const planIds = Array.from(new Set(Array.from(plansByStudent.values()).flatMap(s => Array.from(s))));
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
    const planIds = plansByStudent.get(s.id) ?? new Set<string>();
    const plans = Array.from(planIds)
      .map(planId => ({
        planId,
        planPrice: priceByPlan.get(planId),
        lastDueDate: lastDueByStudentPlan.get(`${s.id}|${planId}`) ?? null,
      }))
      .filter((p): p is { planId: string; planPrice: number; lastDueDate: Date | null } => p.planPrice != null);
    return {
      studentId: s.id,
      academyId: s.academyId!,
      createdAt: s.createdAt ?? new Date(0),
      customMonthlyAmount: s.customMonthlyAmount,
      dueDay: s.paymentDueDay,
      plans,
      chargedPlanIdsThisMonth: chargedPlansByStudent.get(s.id) ?? new Set<string>(),
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
      studentPhone: users.phone,
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

    // WhatsApp complementa o e-mail (mesmo evento de lembrete, dois canais).
    // Falha aqui não bloqueia a marcação: o e-mail é o canal primário.
    const phone = normalizePhoneBR(r.studentPhone);
    if (phone) {
      const valor = formatBRL(r.amount);
      const data = formatDateBR(r.dueDate);
      try {
        await sendWhatsAppTemplate({
          to: phone,
          // Ordem dos parâmetros = ordem das variáveis do template aprovado no Meta
          params: [r.studentName, r.planName, r.academyName, valor, data],
          fallbackText: whatsappReminderText({
            studentName: r.studentName,
            planName: r.planName,
            academyName: r.academyName,
            valor,
            data,
          }),
        });
      } catch (err) {
        console.error(`[billing-job] WhatsApp falhou para pagamento ${r.paymentId}:`, err);
      }
    }

    // Marcado mesmo em modo log (sem SMTP/WhatsApp) para não repetir a cada hora.
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
        const email = isMailerConfigured() ? 'e-mail' : 'e-mail em modo log';
        const zap = isWhatsAppConfigured() ? 'WhatsApp' : 'WhatsApp em modo log';
        log(`[billing-job] ${reminded} lembrete(s) de vencimento (${email} + ${zap} p/ quem tem telefone)`);
      }
    } catch (err) {
      console.error('[billing-job] erro:', err);
    }
  };

  run(); // executa imediatamente no boot (catch-up se o servidor estava fora do ar na virada)
  setInterval(run, INTERVAL_MS);
}
