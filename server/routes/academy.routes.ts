import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";

const router = Router();

// Perfil da própria academia — editável em /settings. O slug fica de fora:
// ele identifica a academia em URLs públicas (check-in, portal) e mudá-lo
// quebraria QR codes já impressos.

// GET /api/academy
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const academy = await storage.getAcademy(academyId);
      if (!academy) return res.status(404).json({ error: 'Academia não encontrada' });

      const { id, name, slug, phone, email, address, description } = academy;
      res.json({ id, name, slug, phone, email, address, description });
    } catch (error) {
      console.error('Get academy error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// PATCH /api/academy
router.patch('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const schema = z.object({
        name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
        phone: z.string().trim().max(30).optional(),
        email: z.string().trim().email('E-mail inválido').or(z.literal('')).optional(),
        address: z.string().trim().max(200).optional(),
        description: z.string().trim().max(500).optional(),
      });
      const data = schema.parse(req.body);

      // Campos de contato vazios viram null (limpar o campo é permitido)
      const updates = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === '' && k !== 'name' ? null : v]),
      );

      const updated = await storage.updateAcademy(academyId, updates);
      if (!updated) return res.status(404).json({ error: 'Academia não encontrada' });

      const { id, name, slug, phone, email, address, description } = updated;
      res.json({ id, name, slug, phone, email, address, description });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update academy error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
