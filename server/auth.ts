import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import IORedis from 'ioredis';
import { storage } from './storage';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
const JWT_EXPIRES_MS = 24 * 60 * 60 * 1000;

// ─── Token blacklist ──────────────────────────────────────────────────────────
// Uses Redis when REDIS_URL is set (required for multi-instance / restarts).
// Falls back to an in-memory Map for single-instance / development.

let redis: IORedis | null = null;
if (process.env.REDIS_URL) {
  redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, enableReadyCheck: false });
  redis.connect().catch((err: Error) => {
    console.error('Redis connection failed — using in-memory token blacklist:', err.message);
    redis = null;
  });
}

const memBlacklist = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  Array.from(memBlacklist.entries()).forEach(([jti, exp]) => {
    if (now > exp) memBlacklist.delete(jti);
  });
}, 60 * 60 * 1000);

export function blacklistToken(jti: string): void {
  if (redis) {
    const ttlSeconds = Math.ceil(JWT_EXPIRES_MS / 1000);
    redis.set(`bl:${jti}`, '1', 'EX', ttlSeconds).catch(() => {
      memBlacklist.set(jti, Date.now() + JWT_EXPIRES_MS);
    });
    return;
  }
  memBlacklist.set(jti, Date.now() + JWT_EXPIRES_MS);
}

async function isTokenBlacklisted(jti: string): Promise<boolean> {
  if (redis) {
    try {
      return (await redis.exists(`bl:${jti}`)) > 0;
    } catch {
      // Redis unavailable — fall through to in-memory check
    }
  }
  const exp = memBlacklist.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) { memBlacklist.delete(jti); return false; }
  return true;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    academyId: string | null;
    name: string;
  };
  tokenJti?: string;
}

export interface JWTPayload {
  jti: string;
  userId: string;
  email: string;
  role: string;
  academyId: string | null;
  name: string;
}

export function generateToken(payload: Omit<JWTPayload, 'jti'>): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso obrigatório' });
    }

    const payload = verifyToken(token);

    if (await isTokenBlacklisted(payload.jti)) {
      return res.status(401).json({ error: 'Token revogado. Faça login novamente.' });
    }

    // Always trust DB over token claims to prevent privilege escalation.
    const user = await storage.getUser(payload.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    // If the user belongs to an academy that no longer exists in the DB
    // (e.g. after a db:push wipe), invalidate the token immediately so the
    // client is forced to re-authenticate instead of reaching a zombie state.
    if (user.academyId && user.role !== 'SUPER_ADMIN') {
      const academy = await storage.getAcademy(user.academyId);
      if (!academy) {
        blacklistToken(payload.jti);
        return res.status(401).json({ error: 'Academia não encontrada. Faça login novamente.' });
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    };
    req.tokenJti = payload.jti;

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
}

export function requireSameAcademy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const pathAcademyId = req.params.academyId;
  const bodyAcademyId = req.body?.academyId;

  if (pathAcademyId && pathAcademyId !== req.user.academyId) {
    return res.status(403).json({ error: 'Acesso negado: recurso pertence a outra academia' });
  }

  if (bodyAcademyId && bodyAcademyId !== req.user.academyId) {
    return res.status(403).json({ error: 'Acesso negado: não é possível alterar recursos de outra academia' });
  }

  // Prevent client from overriding academyId — always inject from authenticated user.
  if (req.body && req.user.academyId) {
    req.body.academyId = req.user.academyId;
  }

  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária' });
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito ao Super Admin' });
  }
  next();
}
