import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock router-level dependencies so we can import the module without a real DB
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../auth', () => ({
  authenticateToken: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireSameAcademy: vi.fn(),
  hashPassword: vi.fn(),
}));

let sanitizeUser: (user: Record<string, unknown>) => Record<string, unknown>;

beforeAll(async () => {
  const mod = await import('../routes/students.routes');
  sanitizeUser = mod.sanitizeUser;
});

describe('sanitizeUser', () => {
  it('removes the password field', () => {
    const user = { id: '1', name: 'Alice', email: 'a@b.com', password: 'hashed', role: 'ALUNO' };
    const result = sanitizeUser(user);
    expect(result).not.toHaveProperty('password');
  });

  it('preserves all non-password fields', () => {
    const user = { id: '1', name: 'Alice', email: 'a@b.com', password: 'hashed', belt: 'blue', active: true };
    const result = sanitizeUser(user);
    expect(result).toMatchObject({ id: '1', name: 'Alice', email: 'a@b.com', belt: 'blue', active: true });
  });

  it('handles user with no password field gracefully', () => {
    const user = { id: '2', name: 'Bob', email: 'b@b.com' };
    const result = sanitizeUser(user);
    expect(result).toEqual({ id: '2', name: 'Bob', email: 'b@b.com' });
  });
});
