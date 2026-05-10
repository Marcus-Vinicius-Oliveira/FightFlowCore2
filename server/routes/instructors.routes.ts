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

// GET /api/instructors
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

      const instructors = await storage.getUsersByAcademy(academyId, 'PROFESSOR', limit ? { limit, offset } : undefined);

      const sanitized = instructors.map(i => ({
        id: i.id, name: i.name, email: i.email,
        phone: i.phone, active: i.active, createdAt: i.createdAt,
      }));

      if (limit !== undefined) {
        const total = await storage.countUsersByAcademy(academyId, 'PROFESSOR');
        return res.json({ data: sanitized, total, limit, offset });
      }

      res.json(sanitized);
    } catch (error) {
      console.error('Get instructors error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/instructors/:id
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
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);
      const instructorId = req.params.id;

      const existing = await storage.getUser(instructorId);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'PROFESSOR') {
        return res.status(404).json({ error: 'Instrutor não encontrado' });
      }

      if (updateData.email && updateData.email !== existing.email) {
        const conflict = await storage.getUserByEmail(updateData.email);
        if (conflict) return res.status(409).json({ error: 'Email já em uso' });
      }

      const updated = await storage.updateUser(instructorId, updateData);
      if (!updated) return res.status(404).json({ error: 'Instrutor não encontrado' });

      const { password: _p, ...safe } = updated as any;
      res.json(safe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update instructor error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/instructors/:id — soft delete
router.delete('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'PROFESSOR') {
        return res.status(404).json({ error: 'Instrutor não encontrado' });
      }
      await storage.updateUser(req.params.id, { active: false });
      res.json({ message: 'Instrutor desativado com sucesso' });
    } catch (error) {
      console.error('Delete instructor error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/instructors/:id/permanent
router.delete('/:id/permanent',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId || existing.role !== 'PROFESSOR') {
        return res.status(404).json({ error: 'Instrutor não encontrado' });
      }

      const instructorClasses = await storage.getClassesByInstructor(req.params.id);
      if (instructorClasses.length > 0) {
        return res.status(409).json({
          error: 'Não é possível excluir instrutor com turmas associadas',
          details: `O instrutor possui ${instructorClasses.length} turma(s). Reatribua ou remova-as primeiro.`,
        });
      }

      await storage.deleteUser(req.params.id);
      res.json({ message: 'Instrutor excluído permanentemente' });
    } catch (error) {
      console.error('Permanent delete instructor error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
