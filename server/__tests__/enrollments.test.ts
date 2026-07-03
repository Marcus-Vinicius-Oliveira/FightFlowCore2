import { describe, it, expect, vi } from 'vitest';

// Mock router-level dependencies so we can import the module without a real DB
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../auth', () => ({
  authenticateToken: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireSameAcademy: vi.fn(),
}));

import { hasCapacity } from '../routes/enrollments.routes';

describe('hasCapacity — limite de vagas da turma', () => {
  it('permite matrícula quando há vagas', () => {
    expect(hasCapacity(9, 10)).toBe(true);
  });

  it('bloqueia matrícula quando a turma está cheia', () => {
    expect(hasCapacity(10, 10)).toBe(false);
  });

  it('bloqueia matrícula quando a turma está acima do limite (dados legados)', () => {
    expect(hasCapacity(12, 10)).toBe(false);
  });

  it('permite matrícula ilimitada quando maxCapacity é null', () => {
    expect(hasCapacity(500, null)).toBe(true);
  });

  it('permite matrícula ilimitada quando maxCapacity é undefined', () => {
    expect(hasCapacity(500, undefined)).toBe(true);
  });

  it('trata maxCapacity 0 como sem limite definido (valor inválido de cadastro)', () => {
    expect(hasCapacity(3, 0)).toBe(true);
  });
});
