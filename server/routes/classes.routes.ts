import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";
import { insertClassSchema, insertClassTypeSchema } from "@shared/schema";

const router = Router();

// GET /api/class-types
router.get('/class-types',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });
      const cts = await storage.getClassTypesByAcademy(academyId);
      res.json(cts);
    } catch (error) {
      console.error('Get class types error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/class-types
router.post('/class-types',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = insertClassTypeSchema.parse({ ...req.body, academyId: req.user!.academyId });
      const ct = await storage.createClassType(data);
      res.status(201).json(ct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create class type error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/class-types/:id — update or deactivate
router.patch('/class-types/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        duration: z.number().int().positive().optional(),
        maxCapacity: z.number().int().positive().optional(),
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      const existing = await storage.getClassType(req.params.id);
      if (!existing || existing.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Tipo de aula não encontrado' });
      }

      const updated = await storage.updateClassType(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: 'Tipo de aula não encontrado' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update class type error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/classes
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });
      const allClasses = await storage.getClassesByAcademy(academyId);
      res.json(allClasses);
    } catch (error) {
      console.error('Get classes error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/classes
router.post('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const classData = insertClassSchema.parse({ ...req.body, academyId: req.user!.academyId });

      const instructor = await storage.getUser(classData.instructorId);
      if (!instructor || instructor.academyId !== req.user!.academyId || instructor.role !== 'PROFESSOR') {
        return res.status(400).json({ error: 'Instrutor inválido ou não pertence à sua academia' });
      }

      const classType = await storage.getClassType(classData.classTypeId);
      if (!classType || classType.academyId !== req.user!.academyId) {
        return res.status(400).json({ error: 'Tipo de turma inválido ou não pertence à sua academia' });
      }

      const newClass = await storage.createClass(classData);
      res.status(201).json(newClass);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/classes/schedule/weekly — must be before /:id to avoid shadowing
router.get('/schedule/weekly',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const allClasses = await storage.getClassesByAcademy(academyId);
      const filteredClasses = req.user!.role === 'PROFESSOR'
        ? allClasses.filter(c => c.instructorId === req.user!.id)
        : allClasses;

      const weeklySchedule: Record<string, unknown[]> = {
        "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [],
      };

      filteredClasses.forEach(cls => {
        const day = cls.dayOfWeek.toString();
        weeklySchedule[day].push({
          id: cls.id,
          classType: cls.classType?.name,
          instructor: cls.instructor?.name,
          startTime: cls.startTime,
          endTime: cls.endTime,
          active: cls.active,
        });
      });

      Object.keys(weeklySchedule).forEach(day => {
        (weeklySchedule[day] as any[]).sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      res.json(weeklySchedule);
    } catch (error) {
      console.error('Get weekly schedule error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PATCH /api/classes/:id
router.patch('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const classId = req.params.id;
      const existingClass = await storage.getClass(classId);
      if (!existingClass || existingClass.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }

      const updateSchema = z.object({
        classTypeId: z.string().uuid().optional(),
        instructorId: z.string().uuid().optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      if (updateData.instructorId) {
        const instructor = await storage.getUser(updateData.instructorId);
        if (!instructor || instructor.academyId !== req.user!.academyId || instructor.role !== 'PROFESSOR') {
          return res.status(400).json({ error: 'Instrutor inválido' });
        }
      }

      if (updateData.classTypeId) {
        const classType = await storage.getClassType(updateData.classTypeId);
        if (!classType || classType.academyId !== req.user!.academyId) {
          return res.status(400).json({ error: 'Tipo de turma inválido' });
        }
      }

      const updated = await storage.updateClass(classId, updateData);
      if (!updated) return res.status(404).json({ error: 'Turma não encontrada' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/classes/:id — soft delete
router.delete('/:id',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const existingClass = await storage.getClass(req.params.id);
      if (!existingClass || existingClass.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }
      await storage.updateClass(req.params.id, { active: false });
      res.json({ message: 'Turma desativada com sucesso' });
    } catch (error) {
      console.error('Delete class error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
