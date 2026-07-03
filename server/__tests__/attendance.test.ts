import { describe, it, expect, vi } from 'vitest';

// Mock router-level dependencies so we can import the module without a real DB
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../auth', () => ({
  authenticateToken: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireSameAcademy: vi.fn(),
}));

import { statusToPresent } from '../routes/attendance.routes';

describe('statusToPresent', () => {
  it("marca 'presente' como present = true", () => {
    expect(statusToPresent('presente')).toBe(true);
  });

  it("marca 'falta' como present = false", () => {
    expect(statusToPresent('falta')).toBe(false);
  });

  it("marca 'justificado' como present = false (ausência abonada não conta como presença física)", () => {
    expect(statusToPresent('justificado')).toBe(false);
  });
});
