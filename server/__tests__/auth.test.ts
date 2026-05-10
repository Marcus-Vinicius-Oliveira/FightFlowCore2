import { describe, it, expect, vi, beforeAll } from 'vitest';

// Set env vars before any module is loaded
process.env.JWT_SECRET = 'a'.repeat(64);
delete process.env.REDIS_URL; // ensure in-memory blacklist is used

// Mock storage so authenticateToken doesn't need a real DB
vi.mock('../storage', () => ({
  storage: {
    getUser: vi.fn().mockResolvedValue({
      id: 'user-bl',
      email: 'bl@example.com',
      role: 'ALUNO',
      academyId: null,
      name: 'Blacklisted',
      active: true,
    }),
  },
}));

let generateToken: (p: Omit<import('../auth').JWTPayload, 'jti'>) => string;
let verifyToken: (t: string) => import('../auth').JWTPayload;
let hashPassword: (p: string) => Promise<string>;
let comparePassword: (p: string, h: string) => Promise<boolean>;
let blacklistToken: (jti: string) => void;
let authenticateToken: (req: any, res: any, next: any) => Promise<void>;

beforeAll(async () => {
  const auth = await import('../auth');
  generateToken = auth.generateToken;
  verifyToken = auth.verifyToken;
  hashPassword = auth.hashPassword;
  comparePassword = auth.comparePassword;
  blacklistToken = auth.blacklistToken;
  authenticateToken = auth.authenticateToken;
});

describe('generateToken / verifyToken', () => {
  const payload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'ADMIN_ACADEMIA',
    academyId: 'acad-456',
    name: 'Test User',
  };

  it('generates a JWT and round-trips the payload', () => {
    const token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.academyId).toBe(payload.academyId);
    expect(decoded.name).toBe(payload.name);
  });

  it('assigns a unique jti to each token', () => {
    const t1 = generateToken(payload);
    const t2 = generateToken(payload);
    expect(verifyToken(t1).jti).not.toBe(verifyToken(t2).jti);
  });

  it('throws on a tampered signature', () => {
    const token = generateToken(payload);
    const parts = token.split('.');
    parts[2] = 'invalidsignature';
    expect(() => verifyToken(parts.join('.'))).toThrow();
  });
});

describe('hashPassword / comparePassword', () => {
  it('hashes a password and accepts the correct plain-text', async () => {
    const hash = await hashPassword('my-secret');
    expect(hash).not.toBe('my-secret');
    await expect(comparePassword('my-secret', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse');
    await expect(comparePassword('wrong-horse', hash)).resolves.toBe(false);
  });
});

describe('blacklistToken / authenticateToken (in-memory path)', () => {
  it('allows a fresh token through', async () => {
    const token = generateToken({ userId: 'u1', email: 'u@e.com', role: 'ALUNO', academyId: null, name: 'U' });

    let nextCalled = false;
    let statusCode: number | null = null;
    const mockRes = { status: (c: number) => { statusCode = c; return { json: vi.fn() }; } };

    await authenticateToken(
      { headers: { authorization: `Bearer ${token}` } } as any,
      mockRes as any,
      () => { nextCalled = true; },
    );

    expect(nextCalled).toBe(true);
    expect(statusCode).toBeNull();
  });

  it('blocks a blacklisted token', async () => {
    const token = generateToken({ userId: 'user-bl', email: 'bl@example.com', role: 'ALUNO', academyId: null, name: 'BL' });
    blacklistToken(verifyToken(token).jti);

    let nextCalled = false;
    let statusCode: number | null = null;
    const mockRes = { status: (c: number) => { statusCode = c; return { json: vi.fn() }; } };

    await authenticateToken(
      { headers: { authorization: `Bearer ${token}` } } as any,
      mockRes as any,
      () => { nextCalled = true; },
    );

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(401);
  });
});
