import { describe, it, expect } from 'vitest';
import { formatDateOnly, formatMonthYear, monthKeyOf, monthLabelOf, monthLabelCapOf } from '../dates';

describe('formatDateOnly', () => {
  it('meia-noite UTC (formulário envia "YYYY-MM-DD") não desloca o dia', () => {
    // Em UTC-3, toLocaleDateString sem timeZone mostraria 05/07
    expect(formatDateOnly('2026-07-06T00:00:00.000Z')).toBe('06/07/2026');
  });

  it('meio-dia local da cobrança recorrente também mostra o dia certo', () => {
    expect(formatDateOnly('2026-07-05T15:00:00.000Z')).toBe('05/07/2026'); // 12:00 UTC-3
  });

  it('aceita timestamp em ms', () => {
    expect(formatDateOnly(Date.UTC(2026, 0, 1))).toBe('01/01/2026');
  });
});

describe('formatMonthYear', () => {
  it('vencimento no dia 1º não escorrega para o mês anterior', () => {
    // Em UTC-3, 01/08 00:00Z viraria "julho de 2026"
    expect(formatMonthYear('2026-08-01T00:00:00.000Z')).toBe('agosto de 2026');
  });
});

describe('monthKeyOf', () => {
  it('agrupa o dia 1º no mês certo (partes UTC)', () => {
    expect(monthKeyOf('2026-08-01T00:00:00.000Z')).toBe('2026-08');
  });

  it('meio do mês é inequívoco', () => {
    expect(monthKeyOf('2026-07-15T15:00:00.000Z')).toBe('2026-07');
  });
});

describe('monthLabelOf / monthLabelCapOf', () => {
  it('gera o rótulo a partir da chave', () => {
    expect(monthLabelOf('2026-07')).toBe('julho de 2026');
    expect(monthLabelCapOf('2026-07')).toBe('Julho de 2026');
  });

  it('dezembro não vaza para o ano seguinte', () => {
    expect(monthLabelOf('2026-12')).toBe('dezembro de 2026');
  });
});
