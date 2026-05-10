import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
const JWT_EXPIRES_MS = 24 * 60 * 60 * 1000;

// In-memory token blacklist (jti -> expiry epoch ms).
// For multi-instance deployments, replace with Redis SET with TTL.
const tokenBlacklist = new Map<string, number>();

// Evict expired entries periodically to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  Array.from(tokenBlacklist.entries()).forEach(([jti, exp]) => {
    if (now > exp) tokenBlacklist.delete(jti);
  });
}, 60 * 60 * 1000); // every hour

export function blacklistToken(jti: string): void {
  tokenBlacklist.set(jti, Date.now() + JWT_EXPIRES_MS);
}

function isTokenBlacklisted(jti: string): boolean {
  const exp = tokenBlacklist.get(jti);
  if (exp === undefined) return false;
  if (Date.now() > exp) {
    tokenBlacklist.delete(jti);
    return false;
  }
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
      return res.status(401).json({ error: 'Access token required' });
    }

    const payload = verifyToken(token);

    if (isTokenBlacklisted(payload.jti)) {
      return res.status(401).json({ error: 'Token revogado. Faça login novamente.' });
    }

    // Always trust DB over token claims to prevent privilege escalation.
    const user = await storage.getUser(payload.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User not found or inactive' });
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
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireSameAcademy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const pathAcademyId = req.params.academyId;
  const bodyAcademyId = req.body?.academyId;

  if (pathAcademyId && pathAcademyId !== req.user.academyId) {
    return res.status(403).json({ error: 'Access denied: Cannot access resources from different academy' });
  }

  if (bodyAcademyId && bodyAcademyId !== req.user.academyId) {
    return res.status(403).json({ error: 'Access denied: Cannot modify resources for different academy' });
  }

  // Prevent client from overriding academyId — always inject from authenticated user.
  if (req.body && req.user.academyId) {
    req.body.academyId = req.user.academyId;
  }

  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin access required' });
  }
  next();
}
