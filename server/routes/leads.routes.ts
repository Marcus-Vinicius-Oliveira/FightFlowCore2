import { Router } from "express";
import { z } from "zod";
import { eq, and, asc, min } from "drizzle-orm";
import { db } from "../db";
import { leads, classTypes, LEAD_STAGES } from "@shared/schema";
import {
  authenticateToken,
  requireRole,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

const stageSchema = z.enum(LEAD_STAGES);

// Data date-only vem como "yyyy-MM-dd"; ancora ao meio-dia para não escorregar
// de dia entre UTC e horário local (mesma convenção do restante do app).
const interactionDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .transform(s => new Date(`${s}T12:00:00`));

async function assertClassTypeOwnership(classTypeId: string, academyId: string): Promise<boolean> {
  const [ct] = await db.select({ id: classTypes.id }).from(classTypes)
    .where(and(eq(classTypes.id, classTypeId), eq(classTypes.academyId, academyId)));
  return !!ct;
}

// GET /api/leads — leads ativos (não arquivados) da academia
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId!;
      const rows = await db.select().from(leads)
        .where(and(eq(leads.academyId, academyId), eq(leads.archived, false)))
        .orderBy(asc(leads.position));
      res.json(rows);
    } catch (error) {
      console.error('List leads error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/leads — novo lead entra no topo de "Lead Inicial"
router.post('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId!;
      const body = z.object({
        name: z.string().trim().min(1),
        phone: z.string().trim().optional(),
        classTypeId: z.string().uuid().nullable().optional(),
        nextInteractionAt: interactionDateSchema.optional(),
      }).parse(req.body);

      if (body.classTypeId && !(await assertClassTypeOwnership(body.classTypeId, academyId))) {
        return res.status(400).json({ error: 'Modalidade não pertence à sua academia' });
      }

      const [{ minPos }] = await db.select({ minPos: min(leads.position) }).from(leads)
        .where(and(
          eq(leads.academyId, academyId),
          eq(leads.stage, 'lead-inicial'),
          eq(leads.archived, false),
        ));

      const [created] = await db.insert(leads).values({
        academyId,
        name: body.name,
        phone: body.phone || null,
        classTypeId: body.classTypeId ?? null,
        nextInteractionAt: body.nextInteractionAt ?? null,
        position: (minPos ?? 1) - 1,
      }).returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create lead error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// PATCH /api/leads/:id — edição de campos (inclui arquivar e motivo de perda)
router.patch('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId!;
      const body = z.object({
        name: z.string().trim().min(1).optional(),
        phone: z.string().trim().nullable().optional(),
        classTypeId: z.string().uuid().nullable().optional(),
        nextInteractionAt: interactionDateSchema.nullable().optional(),
        lostReason: z.string().trim().max(200).nullable().optional(),
        archived: z.boolean().optional(),
      }).parse(req.body);

      const [existing] = await db.select().from(leads)
        .where(and(eq(leads.id, req.params.id), eq(leads.academyId, academyId)));
      if (!existing) return res.status(404).json({ error: 'Lead não encontrado' });

      if (body.classTypeId && !(await assertClassTypeOwnership(body.classTypeId, academyId))) {
        return res.status(400).json({ error: 'Modalidade não pertence à sua academia' });
      }

      const [updated] = await db.update(leads).set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.classTypeId !== undefined && { classTypeId: body.classTypeId }),
        ...(body.nextInteractionAt !== undefined && { nextInteractionAt: body.nextInteractionAt }),
        ...(body.lostReason !== undefined && { lostReason: body.lostReason || null }),
        ...(body.archived !== undefined && { archived: body.archived }),
      }).where(eq(leads.id, existing.id)).returning();

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update lead error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// PATCH /api/leads/:id/move — muda etapa e/ou posição na coluna.
// Trocar de etapa zera o relógio de estagnação (stageChangedAt).
router.patch('/:id/move',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId!;
      const body = z.object({
        stage: stageSchema,
        position: z.number().finite(),
        lostReason: z.string().trim().max(200).optional(),
      }).parse(req.body);

      const [existing] = await db.select().from(leads)
        .where(and(eq(leads.id, req.params.id), eq(leads.academyId, academyId)));
      if (!existing) return res.status(404).json({ error: 'Lead não encontrado' });

      const stageChanged = existing.stage !== body.stage;
      const [updated] = await db.update(leads).set({
        stage: body.stage,
        position: body.position,
        ...(stageChanged && { stageChangedAt: new Date() }),
        ...(body.lostReason !== undefined && { lostReason: body.lostReason }),
        // Sair de "perdido" limpa o motivo — não é mais um lead perdido
        ...(stageChanged && existing.stage === 'perdido' && body.stage !== 'perdido' && { lostReason: null }),
      }).where(eq(leads.id, existing.id)).returning();

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Move lead error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
