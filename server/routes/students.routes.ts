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
import { guardianRequirementError, type User } from "@shared/schema";
import { ensureModalityEnrollment } from "../services/modality-enrollment.service";
import { db } from "../db";

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
        guardianName: s.guardianName, guardianPhone: s.guardianPhone,
        guardianRelationship: s.guardianRelationship,
        belt: s.belt, active: s.active, createdAt: s.createdAt,
        // A ficha (StudentDetailDialog) lê o aluno desta lista — campos de
        // cobrança precisam vir junto ou a visualização mostra o fallback
        customMonthlyAmount: s.customMonthlyAmount,
        paymentDueDay: s.paymentDueDay,
      }));

      if (limit !== undefined) {
        const total = await storage.countUsersByAcademy(academyId, 'ALUNO');
        return res.json({ data: sanitized, total, limit, offset });
      }

      res.json(sanitized);
    } catch (error) {
      console.error('Get students error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/academy-modality-enrollments — all active enrollments for the academy (for client-side filter)
router.get('/academy-modality-enrollments',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const [enrollments, ranks] = await Promise.all([
        storage.getAcademyModalityEnrollments(academyId),
        storage.getAcademyModalityRanks(academyId),
      ]);

      // Deduplicate: explicit enrollments + inferred from modality ranks (for legacy students)
      const seen = new Set<string>();
      const combined = [
        ...enrollments.map(e => ({ studentId: e.studentId, classTypeId: e.classTypeId })),
        ...ranks.map(r => ({ studentId: r.studentId, classTypeId: r.classTypeId })),
      ].filter(item => {
        const key = `${item.studentId}:${item.classTypeId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      res.json(combined);
    } catch (error) {
      console.error('Get academy modality enrollments error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
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
        guardianName: z.string().optional(),
        guardianPhone: z.string().optional(),
        guardianRelationship: z.string().optional(),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional(),
        role: z.enum(['ALUNO', 'PROFESSOR']).default('ALUNO'),
        // Vencimento escolhido pelo aluno (início/meados/fim do mês); null = padrão da academia
        paymentDueDay: z.union([z.literal(5), z.literal(15), z.literal(25)]).nullable().optional(),
      });

      const userData = createSchema.parse(req.body);
      const academyId = req.user!.academyId!;

      if (userData.role === 'ALUNO') {
        const guardianError = guardianRequirementError(userData);
        if (guardianError) return res.status(400).json({ error: guardianError });
      }

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ error: 'Já existe um usuário com este email' });
      }

      const rawPassword = userData.password ?? generateRandomPassword();
      const hashedPassword = await hashPassword(rawPassword);

      const result = await storage.createStudentWithPlanEnforcement({
        ...userData,
        belt: 'branca', // always starts at white belt
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
      res.status(500).json({ error: 'Erro interno do servidor' });
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
        // Responsável legal; null limpa o campo (permitido apenas para aluno maior de idade)
        guardianName: z.string().nullable().optional(),
        guardianPhone: z.string().nullable().optional(),
        guardianRelationship: z.string().nullable().optional(),
        belt: z.string().optional(),
        active: z.boolean().optional(),
        // Desconto individual em centavos (bolsa/família); null volta ao valor do plano
        customMonthlyAmount: z.number().int().nonnegative().nullable().optional(),
        // Vencimento escolhido pelo aluno (5/15/25); null volta ao padrão da academia
        paymentDueDay: z.union([z.literal(5), z.literal(15), z.literal(25)]).nullable().optional(),
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

      // Regra do responsável legal: valida o estado resultante, mas só quando o
      // payload altera a data de nascimento ou mexe no responsável — cadastros
      // antigos de menores sem responsável continuam editáveis em campos não
      // relacionados (ex.: ativar/desativar, trocar faixa).
      const dobChanged = updateData.dateOfBirth !== undefined
        && new Date(updateData.dateOfBirth).getTime() !== (existing.dateOfBirth?.getTime() ?? NaN);
      const touchesGuardian = updateData.guardianName !== undefined
        || updateData.guardianPhone !== undefined;
      if (dobChanged || touchesGuardian) {
        const guardianError = guardianRequirementError({
          dateOfBirth: updateData.dateOfBirth !== undefined ? updateData.dateOfBirth : existing.dateOfBirth,
          guardianName: updateData.guardianName !== undefined ? updateData.guardianName : existing.guardianName,
          guardianPhone: updateData.guardianPhone !== undefined ? updateData.guardianPhone : existing.guardianPhone,
        });
        if (guardianError) return res.status(400).json({ error: guardianError });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/:id/enrollments — turmas em que o aluno está matriculado
router.get('/:id/enrollments',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      const enrollmentsList = await storage.getEnrollmentsByStudentWithClass(req.params.id);
      res.json(enrollmentsList.map(e => ({
        id: e.id,
        classId: e.classId,
        startDate: e.startDate,
        class: e.class ? {
          id: e.class.id,
          dayOfWeek: e.class.dayOfWeek,
          startTime: e.class.startTime,
          endTime: e.class.endTime,
          active: e.class.active,
          classTypeId: e.class.classTypeId,
          classTypeName: e.class.classType?.name,
          instructorId: e.class.instructorId,
          instructorName: e.class.instructor?.name,
        } : null,
      })));
    } catch (error) {
      console.error('Get student enrollments error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/:id/modality-ranks
router.get('/:id/modality-ranks',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const ranks = await storage.getStudentModalityRanks(req.params.id);
      res.json(ranks);
    } catch (error) {
      console.error('Get modality ranks error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/students/:id/graduate-modality
const graduateModalitySchema = z.object({
  classTypeId: z.string().uuid(),
  rankId: z.string().uuid(),
  notes: z.string().optional(),
  promotedAt: z.string().optional(),
});

router.post('/:id/graduate-modality',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      const body = graduateModalitySchema.parse(req.body);
      const promotedAt = body.promotedAt ? new Date(body.promotedAt) : new Date();

      // Get previous rank for history
      const existingRanks = await storage.getStudentModalityRanks(req.params.id);
      const prev = existingRanks.find(r => r.classTypeId === body.classTypeId);

      const [rankEntry, histEntry] = await Promise.all([
        storage.upsertStudentModalityRank({
          studentId: student.id,
          academyId,
          classTypeId: body.classTypeId,
          rankId: body.rankId,
          promotedAt,
          promotedBy: req.user!.id,
        }),
        storage.createStudentRankHistory({
          studentId: student.id,
          academyId,
          classTypeId: body.classTypeId,
          rankBeforeId: prev?.rankId ?? null,
          rankAfterId: body.rankId,
          promotedBy: req.user!.id,
          promotedAt,
          notes: body.notes ?? null,
        }),
        // auto-enroll on first graduation in this modality
        storage.upsertStudentModalityEnrollment({
          studentId: student.id,
          academyId,
          classTypeId: body.classTypeId,
          enrolledAt: promotedAt,
          active: true,
        }),
      ]);

      res.status(201).json({ rank: rankEntry, history: histEntry });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      console.error('Graduate modality error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/:id/rank-history?classTypeId=...
router.get('/:id/rank-history',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const classTypeId = req.query.classTypeId as string | undefined;
      const history = await storage.getStudentRankHistory(req.params.id, classTypeId);
      res.json(history);
    } catch (error) {
      console.error('Get rank history error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/:id/belt-history
router.get('/:id/belt-history',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const history = await storage.getBeltHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error('Get belt history error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/students/:id/graduate
const graduateSchema = z.object({
  beltAfter: z.string().min(1, 'Nova faixa é obrigatória'),
  notes: z.string().optional(),
  promotedAt: z.string().optional(),
});

router.post('/:id/graduate',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      const body = graduateSchema.parse(req.body);
      const promotedAt = body.promotedAt ? new Date(body.promotedAt) : new Date();

      const [entry] = await Promise.all([
        storage.createBeltHistoryEntry({
          studentId: student.id,
          academyId,
          beltBefore: student.belt ?? null,
          beltAfter: body.beltAfter,
          promotedBy: req.user!.id,
          promotedAt,
          notes: body.notes ?? null,
        }),
        storage.updateUser(student.id, { belt: body.beltAfter }),
      ]);

      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Graduate student error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/students/:id/modality-enrollments
router.get('/:id/modality-enrollments',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      const list = await storage.getStudentModalityEnrollments(req.params.id);
      res.json(list);
    } catch (error) {
      console.error('Get student modality enrollments error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/students/:id/modality-enrollments
router.post('/:id/modality-enrollments',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }

      const { classTypeId } = z.object({ classTypeId: z.string().uuid() }).parse(req.body);

      // Transação: vínculo + graduação inicial + histórico nascem juntos
      const { enrollment } = await db.transaction(tx => ensureModalityEnrollment({
        studentId: student.id,
        academyId,
        classTypeId,
        actorId: req.user!.id,
      }, tx));

      res.status(201).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      console.error('Create modality enrollment error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// DELETE /api/students/:id/modality-enrollments/:classTypeId
router.delete('/:id/modality-enrollments/:classTypeId',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const student = await storage.getUser(req.params.id);
      if (!student || student.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Aluno não encontrado' });
      }
      await storage.deactivateStudentModalityEnrollment(req.params.id, req.params.classTypeId);
      res.json({ message: 'Modalidade removida do perfil do aluno' });
    } catch (error) {
      console.error('Deactivate modality enrollment error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
