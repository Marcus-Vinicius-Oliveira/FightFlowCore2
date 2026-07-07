// Geração recorrente de mensalidades e lembretes de vencimento — lógica pura,
// separada do job para ser testável sem banco.

export function monthStart(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1);
}

export function nextMonthStart(reference: Date): Date {
  return new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
}

/**
 * Vencimento no mês de referência, no dia fixo da academia (1–28).
 * Clampado ao último dia do mês por segurança; meio-dia para evitar
 * bordas de fuso (mesma convenção dos seeds).
 */
export function monthlyDueDate(reference: Date, dueDay: number): Date {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Math.max(1, Math.trunc(dueDay) || 1), lastDay);
  return new Date(year, month, day, 12, 0, 0, 0);
}

/** Desconto individual (bolsa/família) prevalece sobre o preço do plano. Zero é desconto válido (bolsista 100%). */
export function resolveMonthlyAmount(planPrice: number, customMonthlyAmount: number | null | undefined): number {
  return customMonthlyAmount ?? planPrice;
}

/** Idempotência da geração: já existe pagamento (qualquer status) com vencimento dentro do mês de referência? */
export function hasPaymentInMonth(dueDates: Date[], reference: Date): boolean {
  const start = monthStart(reference).getTime();
  const end = nextMonthStart(reference).getTime();
  return dueDates.some(d => {
    const t = d.getTime();
    return t >= start && t < end;
  });
}

/** Um plano cobrável do aluno (uma modalidade). */
export interface CandidatePlan {
  planId: string;
  planPrice: number;
}

export interface ChargeCandidate {
  studentId: string;
  academyId: string;
  /** Quando o aluno entrou — matriculado depois do vencimento do mês só é cobrado a partir do mês seguinte */
  createdAt: Date;
  customMonthlyAmount: number | null;
  /** Planos distintos com matrícula ativa (um por modalidade). Cobra-se um por um.
   *  Na falta de matrícula ativa, o job preenche com o plano da última mensalidade (base legada). */
  plans: CandidatePlan[];
  /** Planos que já têm mensalidade neste mês — idempotência por aluno+plano
   *  (não mais por aluno, senão a 2ª modalidade nunca seria cobrada). */
  chargedPlanIdsThisMonth: Set<string>;
}

export interface MonthlyCharge {
  studentId: string;
  academyId: string;
  membershipPlanId: string;
  amount: number;
  dueDate: Date;
  status: 'pending';
}

/** Decide quais mensalidades gerar no mês de referência. Pura: o job só monta os candidatos e insere.
 *  Cobrança por modalidade: uma mensalidade por plano ativo do aluno. */
export function buildMonthlyCharges(
  candidates: ChargeCandidate[],
  reference: Date,
  dueDayByAcademy: Map<string, number>,
): MonthlyCharge[] {
  const charges: MonthlyCharge[] = [];
  for (const c of candidates) {
    if (c.plans.length === 0) continue;                // sem plano conhecido, sem cobrança automática
    const dueDate = monthlyDueDate(reference, dueDayByAcademy.get(c.academyId) ?? 5);
    if (c.createdAt > dueDate) continue;               // entrou depois do vencimento — cobra do próximo mês
    // Desconto individual (valor absoluto) só se aplica quando há uma única
    // modalidade; com várias, cada plano cobra o próprio preço cheio.
    const single = c.plans.length === 1;
    for (const p of c.plans) {
      if (c.chargedPlanIdsThisMonth.has(p.planId)) continue;   // idempotência por aluno+plano
      charges.push({
        studentId: c.studentId,
        academyId: c.academyId,
        membershipPlanId: p.planId,
        amount: single ? resolveMonthlyAmount(p.planPrice, c.customMonthlyAmount) : p.planPrice,
        dueDate,
        status: 'pending',
      });
    }
  }
  return charges;
}

/**
 * Lembrete D-N: mensalidade pendente, nunca lembrada, vencendo em até daysBefore
 * dias (contagem por dia de calendário). Vencidas não recebem lembrete — atraso
 * é tratado pelo markOverduePayments.
 */
export function shouldRemind(
  payment: { status: string; reminderSentAt: Date | null; dueDate: Date },
  now: Date,
  daysBefore: number,
): boolean {
  if (payment.status !== 'pending' || payment.reminderSentAt) return false;
  const MS_DAY = 24 * 60 * 60 * 1000;
  const due = new Date(payment.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / MS_DAY);
  return diffDays >= 0 && diffDays <= daysBefore;
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

export interface ReminderContent {
  subject: string;
  text: string;
}

export function reminderEmail(input: {
  studentName: string;
  planName: string;
  academyName: string;
  amount: number;
  dueDate: Date;
}): ReminderContent {
  const valor = formatBRL(input.amount);
  const data = formatDateBR(input.dueDate);
  return {
    subject: `Lembrete: sua mensalidade vence em ${data}`,
    text: [
      `Olá, ${input.studentName}!`,
      '',
      `Sua mensalidade do plano ${input.planName} na academia ${input.academyName}, no valor de ${valor}, vence em ${data}.`,
      '',
      'Se o pagamento já foi realizado, por favor desconsidere este e-mail.',
      '',
      'Bons treinos!',
      `Equipe ${input.academyName}`,
    ].join('\n'),
  };
}
