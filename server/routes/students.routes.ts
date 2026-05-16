import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import {
  authenticateToken,
  hashPassword,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";
import type { User } from "@shared/schema";

const router = Router();

function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(randomBytes(12))
    .map(b => chars[b % chars.length])
    .join('');
}

export function sanitizeUser(user: User) {
  const { password: _p, ...safe } = user;
  return safe;
}


// GET /api/students
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const students = await storage.getUsersByAcademy(academyId, 'ALUNO', limit ? { limit, offset } : undefined);

      const sanitized = students.map(s => ({
        id: s.id, name: s.name, email: s.email,
        phone: s.phone, dateOfBirth: s.dateOfBirth,
        belt: s.belt, active: s.active, createdAt: s.createdAt,
      }));

      if (limit !== undefined) {
        const total = await storage.countUsersByAcademy(academyId, 'ALUNO');
        return res.json({ data: sanitized, total, limit, offset });
      }

      res.json(sanitized);
    } catch (error) {
      console.error('Get students error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/students/:id
router.get('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId || student.role !== 'ALUNO') {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const { password: _p, ...safe } = student;
      res.json(safe);
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/students
router.post('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        dateOfBirth: z.string().optional(),
        belt: z.string().optional(),
        role: z.enum(['ALUNO', 'PROFESSOR']).default('ALUNO'),
      });

      const userData = createSchema.parse(req.body);
      const academyId = req.user!.academyId!;

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ error: 'Já existe um usuário com este email' });
      }

      const defaultPassword = generateRandomPassword();
      const hashedPassword = await hashPassword(defaultPassword);

      const result = await storage.createStudentWithPlanEnforcement({
        ...userData,
        academyId,
        password: hashedPassword,
        dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : undefined,
      });

      if ('limitError' in result) {
        return res.status(403).json({ error: result.limitError });
      }

      res.status(201).json(sanitizeUser(result.user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/students/:id
router.patch('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        dateOfBirth: z.string().optional(),
        belt: z.string().optional(),
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);
      const studentId = req.params.id;

      const existing = await storage.getUser(studentId);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'ALUNO') {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      if (updateData.email && updateData.email !== existing.email) {
        const conflict = await storage.getUserByEmail(updateData.email);
        if (conflict) return res.status(409).json({ error: 'Email já em uso' });
      }

      const updated = await storage.updateUser(studentId, {
        ...updateData,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
      });

      if (!updated) return res.status(404).json({ error: 'Aluno não encontrado' });
      res.json(sanitizeUser(updated));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update student error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/students/:id — soft delete
router.delete('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'ALUNO') {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      await storage.updateUser(req.params.id, { active: false });
      res.json({ message: 'Aluno desativado com sucesso' });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/students/:id/permanent
router.delete('/:id/permanent',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'ALUNO') {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      const [enrollmentsList, attendanceList, paymentsList] = await Promise.all([
        storage.getEnrollmentsByStudent(req.params.id),
        storage.getAttendanceByStudent(req.params.id),
        storage.getPaymentsByStudent(req.params.id),
      ]);

      if (enrollmentsList.length > 0 || attendanceList.length > 0 || paymentsList.length > 0) {
        return res.status(409).json({
          error: 'Não é possível excluir permanentemente um aluno com registros associados. Remova matrículas, presenças e pagamentos primeiro.',
        });
      }

      await storage.deleteUser(req.params.id);
      res.json({ message: 'Aluno excluído permanentemente' });
    } catch (error) {
      console.error('Permanent delete student error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
