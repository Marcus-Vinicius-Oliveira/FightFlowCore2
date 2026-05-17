import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";

const router = Router();

// ─── Graduation Systems ────────────────────────────────────────────────────────

// GET /api/graduation/systems
router.get('/systems',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const systems = await storage.getGraduationSystemsByAcademy(academyId);

      // Enrich each system with its ranks
      const withRanks = await Promise.all(
        systems.map(async (sys) => ({
          ...sys,
          ranks: await storage.getGraduationRanksBySystem(sys.id),
        }))
      );

      res.json(withRanks);
    } catch (error) {
      console.error('Get graduation systems error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/graduation/systems
router.post('/systems',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const schema = z.object({
        name: z.string().min(1),
        classTypeId: z.string().uuid().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const sys = await storage.createGraduationSystem({ ...data, academyId });
      res.status(201).json(sys);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      if ((error as any)?.code === '23505') return res.status(409).json({ error: 'Já existe um sistema para esta modalidade' });
      console.error('Create graduation system error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/graduation/systems/:id
router.patch('/systems/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sys = await storage.getGraduationSystem(req.params.id);
      if (!sys || sys.academyId !== req.user!.academyId) return res.status(404).json({ error: 'Sistema não encontrado' });

      const schema = z.object({ name: z.string().min(1).optional() });
      const data = schema.parse(req.body);
      const updated = await storage.updateGraduationSystem(req.params.id, data);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      console.error('Update graduation system error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/graduation/systems/:id
router.delete('/systems/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sys = await storage.getGraduationSystem(req.params.id);
      if (!sys || sys.academyId !== req.user!.academyId) return res.status(404).json({ error: 'Sistema não encontrado' });

      await storage.deleteGraduationSystem(req.params.id);
      res.json({ message: 'Sistema removido' });
    } catch (error) {
      console.error('Delete graduation system error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── Graduation Ranks ──────────────────────────────────────────────────────────

// GET /api/graduation/systems/:id/ranks
router.get('/systems/:id/ranks',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sys = await storage.getGraduationSystem(req.params.id);
      if (!sys || sys.academyId !== req.user!.academyId) return res.status(404).json({ error: 'Sistema não encontrado' });

      const ranks = await storage.getGraduationRanksBySystem(req.params.id);
      res.json(ranks);
    } catch (error) {
      console.error('Get ranks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/graduation/systems/:id/ranks
router.post('/systems/:id/ranks',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const sys = await storage.getGraduationSystem(req.params.id);
      if (!sys || sys.academyId !== req.user!.academyId) return res.status(404).json({ error: 'Sistema não encontrado' });

      const schema = z.object({
        name: z.string().min(1),
        displayOrder: z.number().int().default(0),
        colorClass: z.string().default('bg-gray-400 text-white'),
      });
      const data = schema.parse(req.body);
      const rank = await storage.createGraduationRank({ ...data, systemId: req.params.id });
      res.status(201).json(rank);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      console.error('Create rank error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/graduation/ranks/:id
router.patch('/ranks/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        displayOrder: z.number().int().optional(),
        colorClass: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const updated = await storage.updateGraduationRank(req.params.id, data);
      if (!updated) return res.status(404).json({ error: 'Graduação não encontrada' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: 'Validação', details: error.errors });
      console.error('Update rank error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/graduation/ranks/:id
router.delete('/ranks/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await storage.deleteGraduationRank(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Graduação não encontrada' });
      res.json({ message: 'Graduação removida' });
    } catch (error) {
      console.error('Delete rank error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── Academy modality ranks (snapshot all students) ───────────────────────────

// GET /api/graduation/modality-ranks  — all current ranks in academy (for student list badges)
router.get('/modality-ranks',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const rows = await storage.getAcademyModalityRanks(academyId);

      // Enrich with rank and classType names for display
      const systems = await storage.getGraduationSystemsByAcademy(academyId);
      const allRanks: Record<string, { name: string; colorClass: string }> = {};
      for (const sys of systems) {
        const ranks = await storage.getGraduationRanksBySystem(sys.id);
        for (const r of ranks) {
          allRanks[r.id] = { name: r.name, colorClass: r.colorClass };
        }
      }

      res.json(rows.map(r => ({
        studentId: r.studentId,
        classTypeId: r.classTypeId,
        rankId: r.rankId,
        rankName: allRanks[r.rankId]?.name ?? '—',
        colorClass: allRanks[r.rankId]?.colorClass ?? 'bg-gray-400 text-white',
        promotedAt: r.promotedAt,
      })));
    } catch (error) {
      console.error('Get modality ranks error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
