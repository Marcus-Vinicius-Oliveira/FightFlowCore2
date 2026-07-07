import { describe, it, expect } from 'vitest';
import {
  monthStart, nextMonthStart, monthlyDueDate, resolveMonthlyAmount,
  hasPaymentInMonth, buildMonthlyCharges, shouldRemind, reminderEmail,
  formatBRL, type ChargeCandidate,
} from '../lib/recurring';

// Mês de referência dos testes: julho/2026 (dia 15, meio do mês)
const JUL = new Date(2026, 6, 15, 10, 0, 0);

function candidate(over: Partial<ChargeCandidate> = {}): ChargeCandidate {
  return {
    studentId: 's1',
    academyId: 'a1',
    createdAt: new Date(2026, 0, 10),
    customMonthlyAmount: null,
    plans: [{ planId: 'p1', planPrice: 15000 }],
    chargedPlanIdsThisMonth: new Set<string>(),
    ...over,
  };
}

describe('monthlyDueDate — vencimento no dia fixo da academia', () => {
  it('gera no dia configurado do mês de referência, ao meio-dia', () => {
    const due = monthlyDueDate(JUL, 5);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(6);
    expect(due.getDate()).toBe(5);
    expect(due.getHours()).toBe(12);
  });

  it('clampa ao último dia em meses curtos (dia 30 em fevereiro)', () => {
    const due = monthlyDueDate(new Date(2026, 1, 10), 30);
    expect(due.getMonth()).toBe(1);
    expect(due.getDate()).toBe(28); // 2026 não é bissexto
  });

  it('dia inválido (0 ou negativo) cai no dia 1', () => {
    expect(monthlyDueDate(JUL, 0).getDate()).toBe(1);
    expect(monthlyDueDate(JUL, -3).getDate()).toBe(1);
  });
});

describe('resolveMonthlyAmount — valor do plano com desconto individual', () => {
  it('sem desconto usa o preço do plano', () => {
    expect(resolveMonthlyAmount(15000, null)).toBe(15000);
    expect(resolveMonthlyAmount(15000, undefined)).toBe(15000);
  });

  it('desconto individual prevalece sobre o plano', () => {
    expect(resolveMonthlyAmount(15000, 9900)).toBe(9900);
  });

  it('zero é desconto válido (bolsista 100%)', () => {
    expect(resolveMonthlyAmount(15000, 0)).toBe(0);
  });
});

describe('hasPaymentInMonth — idempotência da geração', () => {
  it('detecta pagamento com vencimento dentro do mês de referência', () => {
    expect(hasPaymentInMonth([new Date(2026, 6, 5)], JUL)).toBe(true);
  });

  it('inclui os limites do mês (dia 1 e último dia)', () => {
    expect(hasPaymentInMonth([new Date(2026, 6, 1, 0, 0)], JUL)).toBe(true);
    expect(hasPaymentInMonth([new Date(2026, 6, 31, 23, 59)], JUL)).toBe(true);
  });

  it('ignora pagamentos de outros meses', () => {
    expect(hasPaymentInMonth([new Date(2026, 5, 5), new Date(2026, 7, 5)], JUL)).toBe(false);
  });

  it('vazio → não há pagamento no mês', () => {
    expect(hasPaymentInMonth([], JUL)).toBe(false);
  });
});

describe('buildMonthlyCharges — decisão de geração do mês', () => {
  const dueDays = new Map([['a1', 5]]);

  it('gera cobrança pendente com vencimento no dia da academia e valor do plano', () => {
    const charges = buildMonthlyCharges([candidate()], JUL, dueDays);
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      studentId: 's1', academyId: 'a1', membershipPlanId: 'p1',
      amount: 15000, status: 'pending',
    });
    expect(charges[0].dueDate.getDate()).toBe(5);
    expect(charges[0].dueDate.getMonth()).toBe(6);
  });

  it('não duplica quem já tem pagamento no mês (idempotência)', () => {
    const charges = buildMonthlyCharges([candidate({ chargedPlanIdsThisMonth: new Set(['p1']) })], JUL, dueDays);
    expect(charges).toEqual([]);
  });

  it('rodar duas vezes no mesmo período não gera duplicata', () => {
    const first = buildMonthlyCharges([candidate()], JUL, dueDays);
    expect(first).toHaveLength(1);
    // segunda rodada: o pagamento da primeira já existe no banco (plano p1 já cobrado)
    const second = buildMonthlyCharges([candidate({ chargedPlanIdsThisMonth: new Set(['p1']) })], JUL, dueDays);
    expect(second).toEqual([]);
  });

  it('aplica o desconto individual do aluno (modalidade única)', () => {
    const charges = buildMonthlyCharges([candidate({ customMonthlyAmount: 9900 })], JUL, dueDays);
    expect(charges[0].amount).toBe(9900);
  });

  it('pula aluno sem plano conhecido (sem matrícula e sem histórico)', () => {
    const charges = buildMonthlyCharges([candidate({ plans: [] })], JUL, dueDays);
    expect(charges).toEqual([]);
  });

  it('cobra uma mensalidade por modalidade (2 planos → 2 cobranças com preço cheio)', () => {
    const charges = buildMonthlyCharges(
      [candidate({ plans: [{ planId: 'p1', planPrice: 15000 }, { planId: 'p2', planPrice: 12000 }] })],
      JUL, dueDays,
    );
    expect(charges).toHaveLength(2);
    expect(charges.map(c => c.membershipPlanId).sort()).toEqual(['p1', 'p2']);
    const byPlan = new Map(charges.map(c => [c.membershipPlanId, c.amount]));
    expect(byPlan.get('p1')).toBe(15000);
    expect(byPlan.get('p2')).toBe(12000);
  });

  it('idempotência por aluno+plano: gera só a modalidade ainda não cobrada no mês', () => {
    const charges = buildMonthlyCharges(
      [candidate({
        plans: [{ planId: 'p1', planPrice: 15000 }, { planId: 'p2', planPrice: 12000 }],
        chargedPlanIdsThisMonth: new Set(['p1']),
      })],
      JUL, dueDays,
    );
    expect(charges).toHaveLength(1);
    expect(charges[0].membershipPlanId).toBe('p2');
  });

  it('desconto individual não se aplica quando há múltiplas modalidades', () => {
    const charges = buildMonthlyCharges(
      [candidate({
        plans: [{ planId: 'p1', planPrice: 15000 }, { planId: 'p2', planPrice: 12000 }],
        customMonthlyAmount: 9900,
      })],
      JUL, dueDays,
    );
    const byPlan = new Map(charges.map(c => [c.membershipPlanId, c.amount]));
    expect(byPlan.get('p1')).toBe(15000);
    expect(byPlan.get('p2')).toBe(12000);
  });

  it('pula aluno que entrou depois do vencimento do mês (primeira cobrança fica para o mês seguinte)', () => {
    const charges = buildMonthlyCharges(
      [candidate({ createdAt: new Date(2026, 6, 20) })], // entrou dia 20, vencimento era dia 5
      JUL, dueDays,
    );
    expect(charges).toEqual([]);
  });

  it('cobra aluno que entrou antes do vencimento do mesmo mês', () => {
    const charges = buildMonthlyCharges(
      [candidate({ createdAt: new Date(2026, 6, 2) })], // entrou dia 2, vence dia 5
      JUL, dueDays,
    );
    expect(charges).toHaveLength(1);
  });

  it('academia sem configuração usa o dia 5 como default', () => {
    const charges = buildMonthlyCharges([candidate()], JUL, new Map());
    expect(charges[0].dueDate.getDate()).toBe(5);
  });

  it('respeita o dia de vencimento configurado por academia', () => {
    const charges = buildMonthlyCharges([candidate()], JUL, new Map([['a1', 10]]));
    expect(charges[0].dueDate.getDate()).toBe(10);
  });
});

describe('shouldRemind — janela do lembrete D-N', () => {
  const pending = (dueDate: Date) => ({ status: 'pending', reminderSentAt: null, dueDate });

  it('lembra quando faltam até N dias para o vencimento', () => {
    const now = new Date(2026, 6, 2, 9, 0);
    expect(shouldRemind(pending(new Date(2026, 6, 5, 12, 0)), now, 3)).toBe(true);   // D-3
    expect(shouldRemind(pending(new Date(2026, 6, 3, 12, 0)), now, 3)).toBe(true);   // D-1
    expect(shouldRemind(pending(new Date(2026, 6, 2, 12, 0)), now, 3)).toBe(true);   // D-0 (vence hoje)
  });

  it('não lembra quando o vencimento está além da janela', () => {
    const now = new Date(2026, 6, 1, 9, 0);
    expect(shouldRemind(pending(new Date(2026, 6, 5, 12, 0)), now, 3)).toBe(false); // faltam 4 dias
  });

  it('não lembra mensalidade já vencida (atraso é papel do markOverduePayments)', () => {
    const now = new Date(2026, 6, 6, 9, 0);
    expect(shouldRemind(pending(new Date(2026, 6, 5, 12, 0)), now, 3)).toBe(false);
  });

  it('não repete lembrete já enviado', () => {
    const now = new Date(2026, 6, 4, 9, 0);
    expect(shouldRemind(
      { status: 'pending', reminderSentAt: new Date(2026, 6, 2), dueDate: new Date(2026, 6, 5, 12, 0) },
      now, 3,
    )).toBe(false);
  });

  it('não lembra mensalidade paga ou já marcada como atrasada', () => {
    const now = new Date(2026, 6, 4, 9, 0);
    const due = new Date(2026, 6, 5, 12, 0);
    expect(shouldRemind({ status: 'paid', reminderSentAt: null, dueDate: due }, now, 3)).toBe(false);
    expect(shouldRemind({ status: 'overdue', reminderSentAt: null, dueDate: due }, now, 3)).toBe(false);
  });
});

describe('reminderEmail — texto do lembrete em pt-BR', () => {
  it('monta assunto e corpo com plano, academia, valor e data', () => {
    const content = reminderEmail({
      studentName: 'João Pires',
      planName: 'Mensal Padrão',
      academyName: 'Anjo',
      amount: 15000,
      dueDate: new Date(2026, 6, 5, 12, 0),
    });
    expect(content.subject).toBe('Lembrete: sua mensalidade vence em 05/07/2026');
    expect(content.text).toContain('Olá, João Pires!');
    expect(content.text).toContain('Mensal Padrão');
    expect(content.text).toContain('05/07/2026');
    expect(content.text).toContain(formatBRL(15000));
  });
});

describe('monthStart / nextMonthStart — janela do mês de referência', () => {
  it('delimita o mês corrente', () => {
    expect(monthStart(JUL)).toEqual(new Date(2026, 6, 1));
    expect(nextMonthStart(JUL)).toEqual(new Date(2026, 7, 1));
  });

  it('vira o ano em dezembro', () => {
    expect(nextMonthStart(new Date(2026, 11, 20))).toEqual(new Date(2027, 0, 1));
  });
});
