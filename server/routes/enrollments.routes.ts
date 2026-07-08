import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";
import { enrollStudentInClassGroup } from "../services/class-enrollment.service";

const router = Router({ mergeParams: true });

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

      const alreadyEnrolled = await storage.getEnrollmentByStudentAndClass(data.studentId, classId);
      if (alreadyEnrolled) {
        return res.status(409).json({ error: 'Aluno já está matriculado nesta turma' });
      }

      // Sem limite de vagas: a academia controla lotação por fora do app.
      // Delegado ao serviço de grupo (grupo de 1): validações + matrícula +
      // vínculo de modalidade em uma única transação.
      const result = await enrollStudentInClassGroup({
        studentId: data.studentId,
        membershipPlanId: data.membershipPlanId,
        classIds: [classId],
        academyId,
        actorId: req.user!.id,
        startDate: data.startDate,
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.status(201).json({
        ...result.created[0],
        modalityAdded: result.modalityAdded,
        modalityName: result.modalityName,
        firstPaymentCreated: result.firstPaymentCreated,
      });
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
