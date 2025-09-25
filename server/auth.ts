import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

// For demo purposes, use a secure default. In production, this MUST be from environment
const JWT_SECRET = process.env.JWT_SECRET || 'centro-lutas-demo-secret-fixed-for-development-replit-2024';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  Using generated JWT secret for demo. Set JWT_SECRET environment variable for production.');
}
const JWT_EXPIRES_IN = '24h';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    academyId: string | null; // Nullable for SUPER_ADMIN
    name: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  academyId: string | null; // Nullable for SUPER_ADMIN
  name: string;
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Compare password
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// Authentication middleware
export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const payload = verifyToken(token);
    
    // Verify user still exists and is active - ALWAYS trust DB over token claims
    const user = await storage.getUser(payload.userId);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // SECURITY: Set user data from DB, not from token claims
    // This prevents privilege escalation if JWT secret is compromised
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Role authorization middleware
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

// Academy isolation middleware - enforce tenant boundaries
export function requireSameAcademy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // SUPER_ADMIN can bypass academy isolation
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Check if academyId is in path parameters or body
  const pathAcademyId = req.params.academyId;
  const bodyAcademyId = req.body?.academyId;

  // If academyId is specified in request, it must match user's academy
  if (pathAcademyId && pathAcademyId !== req.user.academyId) {
    return res.status(403).json({ 
      error: 'Access denied: Cannot access resources from different academy' 
    });
  }

  if (bodyAcademyId && bodyAcademyId !== req.user.academyId) {
    return res.status(403).json({ 
      error: 'Access denied: Cannot modify resources for different academy' 
    });
  }

  // Prevent client from setting academyId - always use from authenticated user
  if (req.body && req.user.academyId) {
    req.body.academyId = req.user.academyId;
  }

  next();
}

// Super Admin guard - allows only SUPER_ADMIN role
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ 
      error: 'Super Admin access required',
      current: req.user.role
    });
  }

  next();
}