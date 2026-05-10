import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from "../auth";
import {
  insertAcademySchema,
  insertPlanoSchema,
  insertAssinaturaSchema,
} from "@shared/schema";

const router = Router();

// GET /api/superadmin/stats
router.get('/stats',
  authenticateToken,
  requireSuperAdmin,
  async (_req, res) => {
    try {
      const [academiesList, planosList, assinaturasList] = await Promise.all([
        storage.getAllAcademies(),
        storage.getAllPlanos(),
        storage.getAllAssinaturas(),
      ]);
      res.json({
        totalAcademies: academiesList.length,
        totalPlanos: planosList.length,
        totalAssinaturas: assinaturasList.length,
        activePlanos: planosList.filter(p => p.ativo).length,
        activeAssinaturas: assinaturasList.filter(a => a.status === 'ativa').length,
      });
    } catch (error) {
      console.error('Get super admin stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/superadmin/academias
router.get('/academias',
  authenticateToken,
  requireSuperAdmin,
  async (_req, res) => {
    try {
      res.json(await storage.getAllAcademies());
    } catch (error) {
      console.error('Get all academies error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/superadmin/academias/:id
router.get('/academias/:id',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academy = await storage.getAcademy(req.params.id);
      if (!academy) return res.status(404).json({ error: 'Academia não encontrada' });

      const [assinaturasList, usersList] = await Promise.all([
        storage.getAssinaturasByAcademia(academy.id),
        storage.getUsersByAcademy(academy.id),
      ]);

      res.json({
        ...academy,
        assinaturas: assinaturasList,
        totalUsers: usersList.length,
        students: usersList.filter(u => u.role === 'ALUNO').length,
        professors: usersList.filter(u => u.role === 'PROFESSOR').length,
        admins: usersList.filter(u => u.role === 'ADMIN_ACADEMIA').length,
      });
    } catch (error) {
      console.error('Get academy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/superadmin/academias/:id
router.patch('/academias/:id',
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertAcademySchema.partial().parse(req.body);
      const academy = await storage.updateAcademy(req.params.id, validatedData);
      if (!academy) return res.status(404).json({ error: 'Academia não encontrada' });
      res.json(academy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update academy error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/superadmin/planos
router.get('/planos', authenticateToken, requireSuperAdmin, async (_req, res) => {
  try {
    res.json(await storage.getAllPlanos());
  } catch (error) {
    console.error('Get planos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/superadmin/planos/:id
router.get('/planos/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plano = await storage.getPlano(req.params.id);
    if (!plano) return res.status(404).json({ error: 'Plano não encontrado' });
    res.json(plano);
  } catch (error) {
    console.error('Get plano error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/superadmin/planos
router.post('/planos', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plano = await storage.createPlano(insertPlanoSchema.parse(req.body));
    res.status(201).json(plano);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Create plano error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/superadmin/planos/:id
router.patch('/planos/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const plano = await storage.updatePlano(req.params.id, insertPlanoSchema.partial().parse(req.body));
    if (!plano) return res.status(404).json({ error: 'Plano não encontrado' });
    res.json(plano);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Update plano error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/superadmin/assinaturas
router.get('/assinaturas', authenticateToken, requireSuperAdmin, async (_req, res) => {
  try {
    res.json(await storage.getAllAssinaturas());
  } catch (error) {
    console.error('Get assinaturas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/superadmin/assinaturas
router.post('/assinaturas', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const assinatura = await storage.createAssinatura(insertAssinaturaSchema.parse(req.body));
    res.status(201).json(assinatura);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Create assinatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/superadmin/assinaturas/:id
router.patch('/assinaturas/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const assinatura = await storage.updateAssinatura(req.params.id, insertAssinaturaSchema.partial().parse(req.body));
    if (!assinatura) return res.status(404).json({ error: 'Assinatura não encontrada' });
    res.json(assinatura);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Erro de validação', details: error.errors });
    }
    console.error('Update assinatura error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
