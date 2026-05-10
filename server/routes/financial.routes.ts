import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

// GET /api/payments — list payments for the academy
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const studentId = req.query.studentId as string | undefined;

      let payments;
      if (studentId) {
        const student = await storage.getUser(studentId);
        if (!student || student.academyId !== academyId) {
          return res.status(404).json({ error: 'Aluno não encontrado' });
        }
        payments = await storage.getPaymentsByStudent(studentId);
      } else {
        payments = await storage.getPaymentsByAcademy(academyId, limit ? { limit, offset } : undefined);
      }

      res.json(payments);
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/payments — create payment record
router.post('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const createSchema = z.object({
        studentId: z.string().uuid(),
        membershipPlanId: z.string().uuid(),
        amount: z.number().int().positive('Valor deve ser positivo (em centavos)'),
        dueDate: z.string(),
        paidDate: z.string().optional(),
        status: z.enum(['pending', 'paid', 'overdue']).default('pending'),
        notes: z.string().optional(),
      });

      const data = createSchema.parse(req.body);
      const academyId = req.user!.academyId!;

      const student = await storage.getUser(data.studentId);
      if (!student || student.academyId !== academyId || student.role !== 'ALUNO') {
        return res.status(400).json({ error: 'Aluno não encontrado ou não pertence à sua academia' });
      }

      const plans = await storage.getMembershipPlansByAcademy(academyId);
      if (!plans.some(p => p.id === data.membershipPlanId)) {
        return res.status(400).json({ error: 'Plano de mensalidade não encontrado na sua academia' });
      }

      const payment = await storage.createPayment({
        ...data,
        academyId,
        dueDate: new Date(data.dueDate),
        paidDate: data.paidDate ? new Date(data.paidDate) : undefined,
      });

      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create payment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/payments/:id — update payment (mark as paid, etc.)
router.patch('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateSchema = z.object({
        status: z.enum(['pending', 'paid', 'overdue']).optional(),
        paidDate: z.string().optional(),
        notes: z.string().optional(),
        amount: z.number().int().positive().optional(),
      });

      const updateData = updateSchema.parse(req.body);
      const payment = await storage.getPayment(req.params.id);

      if (!payment || payment.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }

      const updated = await storage.updatePayment(req.params.id, {
        ...updateData,
        paidDate: updateData.paidDate ? new Date(updateData.paidDate) : undefined,
        updatedBy: req.user!.id,
      });

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update payment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/membership-plans
router.get('/membership-plans',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });
      const plans = await storage.getMembershipPlansByAcademy(academyId);
      res.json(plans);
    } catch (error) {
      console.error('Get membership plans error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/membership-plans
router.post('/membership-plans',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1, 'Nome é obrigatório'),
        description: z.string().optional(),
        price: z.number().int().nonnegative('Valor deve ser zero ou positivo (em centavos)'),
        duration: z.number().int().positive('Duração deve ser positiva (em dias)'),
        classesPerWeek: z.number().int().positive().optional(),
      });

      const data = createSchema.parse(req.body);
      const academyId = req.user!.academyId!;

      const plan = await storage.createMembershipPlan({ ...data, academyId });
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create membership plan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
