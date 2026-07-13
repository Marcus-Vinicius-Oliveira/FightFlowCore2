import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  generateToken,
  hashPassword,
  comparePassword,
  authenticateToken,
  blacklistToken,
  type AuthenticatedRequest,
} from "../auth";
import { loginLimiter, signupLimiter } from "../middleware";
import { slugify, nextAvailableSlug } from "../lib/slug";

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await storage.getUserByEmail(email);

    // Check existence and active status before the costly bcrypt call.
    // Return the same generic message to prevent user enumeration.
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    });

    const academy = user.academyId ? await storage.getAcademy(user.academyId) : null;

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        firstAccess: user.firstAccess,
        academy: academy ? { id: academy.id, name: academy.name, slug: academy.slug } : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const signupSchema = z.object({
      name: z.string().min(1, 'Nome é obrigatório'),
      email: z.string().email('Email inválido'),
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      role: z.enum(['ADMIN_ACADEMIA', 'PROFESSOR', 'ALUNO']),
      academyName: z.string().min(1, 'Nome da academia é obrigatório'),
    });

    const validatedData = signupSchema.parse(req.body);

    // Optimistic pre-checks — unique constraints at DB level are the real guard.
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(409).json({ error: 'Já existe um usuário com este email' });
    }

    // Nome repetido não bloqueia o cadastro: o slug ganha sufixo (-2, -3...).
    // O unique do banco continua como guarda final contra corrida.
    const academySlug = await nextAvailableSlug(
      slugify(validatedData.academyName),
      async slug => Boolean(await storage.getAcademyBySlug(slug)),
    );

    // Resolve free trial plan before opening the transaction.
    const allPlanos = await storage.getAllPlanos();
    const freePlano = allPlanos.find(p => p.ativo && p.precoMensal === 0);

    const hashedPassword = await hashPassword(validatedData.password);

    // Single transaction: academy + user + optional trial subscription.
    const { academy, user: newUser } = await storage.createAcademyWithAdmin(
      { name: validatedData.academyName, slug: academySlug, email: validatedData.email },
      {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
      },
      freePlano?.id,
    );

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      academyId: newUser.academyId,
      name: newUser.name,
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        firstAccess: newUser.firstAccess,
        academy: { id: academy.id, name: academy.name, slug: academy.slug },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const passwordSchema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
      confirmPassword: z.string().min(1),
    });

    const { currentPassword, newPassword, confirmPassword } = passwordSchema.parse(req.body);

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem' });
    }

    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Senha atual incorreta' });

    const hashedNewPassword = await hashPassword(newPassword);
    await storage.updateUser(user.id, { password: hashedNewPassword, firstAccess: false });

    // Revoke the current session token and issue a fresh one.
    if (req.tokenJti) blacklistToken(req.tokenJti);

    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      academyId: user.academyId,
      name: user.name,
    });

    res.json({ message: 'Senha alterada com sucesso', token: newToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/logout — server-side token revocation
router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res) => {
  if (req.tokenJti) {
    blacklistToken(req.tokenJti);
  }
  res.json({ message: 'Logout realizado com sucesso' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const academy = user.academyId ? await storage.getAcademy(user.academyId) : null;

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      belt: user.belt,
      dateOfBirth: user.dateOfBirth,
      firstAccess: user.firstAccess,
      active: user.active,
      academy: academy ? { id: academy.id, name: academy.name, slug: academy.slug } : null,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
