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

// GET /api/payments
router.get('/payments',
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

// GET /api/payments/:id
router.get('/payments/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      res.json(payment);
    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/payments
router.post('/payments',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const createSchema = z.object({
        studentId: z.string().uuid(),
        membershipPlanId: z.string().uuid(),
        amount: z.number().int().positive('Valor deve ser positivo (em centavos)'),
        dueDate: z.coerce.date(),
        paidDate: z.coerce.date().optional(),
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

      const payment = await storage.createPayment({ ...data, academyId });
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

// PATCH /api/payments/:id
router.patch('/payments/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateSchema = z.object({
        status: z.enum(['pending', 'paid', 'overdue']).optional(),
        paidDate: z.coerce.date().optional(),
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

// PATCH /api/membership-plans/:id — update or deactivate
router.patch('/membership-plans/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().int().nonnegative().optional(),
        duration: z.number().int().positive().optional(),
        classesPerWeek: z.number().int().positive().optional(),
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      const existing = await storage.getMembershipPlan(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Plano não encontrado' });
      }

      const updated = await storage.updateMembershipPlan(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: 'Plano não encontrado' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update membership plan error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
