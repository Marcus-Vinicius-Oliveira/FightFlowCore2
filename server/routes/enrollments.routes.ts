import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";

const router = Router({ mergeParams: true });

// maxCapacity null/undefined/0 significa "sem limite definido".
export function hasCapacity(currentCount: number, maxCapacity: number | null | undefined): boolean {
  if (!maxCapacity) return true;
  return currentCount < maxCapacity;
}

// GET /api/classes/:classId/enrollments — alunos matriculados na turma
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { classId } = req.params;

      const existingClass = await storage.getClass(classId);
      if (!existingClass || existingClass.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }

      const enrollmentsList = await storage.getEnrollmentsByClass(classId);
      res.json(enrollmentsList.map(e => ({
        id: e.id,
        studentId: e.studentId,
        studentName: e.student?.name,
        studentEmail: e.student?.email,
        membershipPlanId: e.membershipPlanId,
        startDate: e.startDate,
        endDate: e.endDate,
        active: e.active,
      })));
    } catch (error) {
      console.error('Get class enrollments error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/classes/:classId/enrollments — matricula aluno na turma
router.post('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { classId } = req.params;
      const academyId = req.user!.academyId!;

      const createSchema = z.object({
        studentId: z.string().uuid(),
        membershipPlanId: z.string().uuid(),
        startDate: z.coerce.date().optional(),
      });
      const data = createSchema.parse(req.body);

      const existingClass = await storage.getClass(classId);
      if (!existingClass || existingClass.academyId !== academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }
      if (!existingClass.active) {
        return res.status(400).json({ error: 'Não é possível matricular em uma turma desativada' });
      }

      const student = await storage.getUser(data.studentId);
      if (!student || student.academyId !== academyId || student.role !== 'ALUNO') {
        return res.status(400).json({ error: 'Aluno não encontrado ou não pertence à sua academia' });
      }
      if (!student.active) {
        return res.status(400).json({ error: 'Aluno desativado não pode ser matriculado' });
      }

      const plan = await storage.getMembershipPlan(data.membershipPlanId);
      if (!plan || plan.academyId !== academyId) {
        return res.status(400).json({ error: 'Plano de mensalidade não encontrado na sua academia' });
      }

      const alreadyEnrolled = await storage.getEnrollmentByStudentAndClass(data.studentId, classId);
      if (alreadyEnrolled) {
        return res.status(409).json({ error: 'Aluno já está matriculado nesta turma' });
      }

      const activeEnrollments = await storage.getEnrollmentsByClass(classId);
      if (!hasCapacity(activeEnrollments.length, existingClass.classType?.maxCapacity)) {
        return res.status(409).json({
          error: `Turma lotada: limite de ${existingClass.classType?.maxCapacity} aluno(s) atingido.`,
        });
      }

      const enrollment = await storage.createEnrollment({
        studentId: data.studentId,
        classId,
        membershipPlanId: data.membershipPlanId,
        startDate: data.startDate ?? new Date(),
        active: true,
        updatedBy: req.user!.id,
      });

      res.status(201).json(enrollment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create enrollment error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// DELETE /api/classes/:classId/enrollments/:studentId — encerra a matrícula (soft)
router.delete('/:studentId',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { classId, studentId } = req.params;

      const existingClass = await storage.getClass(classId);
      if (!existingClass || existingClass.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }

      const enrollment = await storage.getEnrollmentByStudentAndClass(studentId, classId);
      if (!enrollment) {
        return res.status(404).json({ error: 'Matrícula não encontrada' });
      }

      await storage.deactivateEnrollment(enrollment.id, req.user!.id);
      res.json({ message: 'Matrícula encerrada com sucesso' });
    } catch (error) {
      console.error('Deactivate enrollment error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
