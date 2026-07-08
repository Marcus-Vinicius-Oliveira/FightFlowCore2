import { Router } from "express";
import { z } from "zod";
import { storage, type ClassFilters } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";
import { insertClassSchema, insertClassTypeSchema } from "@shared/schema";
import { generateSchedulePDF } from "../services/schedule-pdf.service";
import { isValidTimeFormat, findInstructorConflict } from "../lib/schedule";
import { enrollStudentInClassGroup, unenrollStudentFromClassGroup } from "../services/class-enrollment.service";

const router = Router();

const timeField = z.string().refine(isValidTimeFormat, 'Horário deve estar no formato HH:MM (ex.: 08:30)');

const timeRangeChecks = {
  check: (data: { startTime?: string; endTime?: string }) =>
    !data.startTime || !data.endTime || data.startTime < data.endTime,
  message: 'Horário de término deve ser depois do horário de início',
};

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
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/classes/modality-summary — alunos ativos distintos e nº de turmas por modalidade
router.get('/modality-summary',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });
      res.json(await storage.getModalityEnrollmentSummary(academyId));
    } catch (error) {
      console.error('Get modality summary error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// POST /api/classes/enrollment-groups — matricula o aluno em todos os registros
// (dias) do grupo em uma única transação (nada de matrícula pela metade).
router.post('/enrollment-groups',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = z.object({
        studentId: z.string().uuid(),
        membershipPlanId: z.string().uuid(),
        classIds: z.array(z.string().uuid()).min(1).max(14),
        startDate: z.coerce.date().optional(),
      }).parse(req.body);

      const result = await enrollStudentInClassGroup({
        ...data,
        academyId: req.user!.academyId!,
        actorId: req.user!.id,
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.status(201).json({
        enrollments: result.created,
        skippedClassIds: result.skippedClassIds,
        modalityAdded: result.modalityAdded,
        modalityName: result.modalityName,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Enroll class group error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// DELETE /api/classes/enrollment-groups — encerra a matrícula (soft) em todos os
// registros do grupo com um único UPDATE.
router.delete('/enrollment-groups',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const data = z.object({
        studentId: z.string().uuid(),
        classIds: z.array(z.string().uuid()).min(1).max(14),
      }).parse(req.body);

      const result = await unenrollStudentFromClassGroup({
        ...data,
        academyId: req.user!.academyId!,
        actorId: req.user!.id,
      });
      if (!result.ok) return res.status(result.status).json({ error: result.error });

      res.json({ message: 'Matrícula encerrada com sucesso', removed: result.removed });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Unenroll class group error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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

      // Reativa se já existe com o mesmo nome (evita duplicatas de classType → graduation system)
      const existing = await storage.getClassTypeByName(data.academyId, data.name);
      if (existing) {
        if (!existing.active) {
          const reactivated = await storage.updateClassType(existing.id, { active: true });
          return res.json(reactivated);
        }
        return res.json(existing); // já ativo, idempotente
      }

      const ct = await storage.createClassType(data);
      res.status(201).json(ct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create class type error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/classes — retorna registros agrupados por (modalidade, professor, horário)
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const daysRaw = req.query.days;
      const filters: ClassFilters = {
        classTypeId:  (req.query.classTypeId  as string) || undefined,
        instructorId: (req.query.instructorId as string) || undefined,
        startTime:    (req.query.startTime    as string) || undefined,
        daysOfWeek:   daysRaw
          ? (Array.isArray(daysRaw) ? daysRaw : [daysRaw])
              .map(Number)
              .filter(n => !isNaN(n) && n >= 0 && n <= 6)
          : undefined,
      };

      const grouped = await storage.getClassesByAcademyGrouped(academyId, filters);
      res.json(grouped);
    } catch (error) {
      console.error('Get classes error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      const classData = insertClassSchema
        .extend({ startTime: timeField, endTime: timeField })
        .refine(timeRangeChecks.check, timeRangeChecks.message)
        .parse({ ...req.body, academyId: req.user!.academyId });

      const instructor = await storage.getUser(classData.instructorId);
      if (!instructor || instructor.academyId !== req.user!.academyId || instructor.role !== 'PROFESSOR') {
        return res.status(400).json({ error: 'Instrutor inválido ou não pertence à sua academia' });
      }

      const classType = await storage.getClassType(classData.classTypeId);
      if (!classType || classType.academyId !== req.user!.academyId) {
        return res.status(400).json({ error: 'Tipo de turma inválido ou não pertence à sua academia' });
      }

      const instructorClasses = await storage.getClassesByInstructor(classData.instructorId);
      const conflict = findInstructorConflict(instructorClasses, classData);
      if (conflict) {
        return res.status(409).json({
          error: `Conflito de horário: o professor já tem aula das ${conflict.startTime} às ${conflict.endTime} neste dia.`,
        });
      }

      const newClass = await storage.createClass(classData);
      res.status(201).json(newClass);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Create class error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/classes/export/pdf — grade horária em PDF (A4 landscape)
router.get('/export/pdf',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const [academy, classes] = await Promise.all([
        storage.getAcademy(academyId),
        storage.getClassesByAcademy(academyId),
      ]);

      const pdf = await generateSchedulePDF(academy?.name ?? 'Academia', classes);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="grade_horaria.pdf"');
      res.setHeader('Content-Length', pdf.length);
      res.end(pdf);
    } catch (error: any) {
      console.error('PDF export error:', error);
      const isBrowserMissing = /executable|chromium|browser/i.test(error?.message ?? '');
      if (isBrowserMissing) {
        return res.status(503).json({
          error: 'Navegador Chromium não disponível. Execute: npx playwright install chromium',
        });
      }
      res.status(500).json({ error: 'Erro ao gerar PDF' });
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
        startTime: timeField.optional(),
        endTime: timeField.optional(),
        active: z.boolean().optional(),
      });

      const updateData = updateSchema.parse(req.body);

      // Valida o intervalo com os valores efetivos (novos ou existentes)
      const effective = {
        instructorId: updateData.instructorId ?? existingClass.instructorId,
        dayOfWeek: updateData.dayOfWeek ?? existingClass.dayOfWeek,
        startTime: updateData.startTime ?? existingClass.startTime,
        endTime: updateData.endTime ?? existingClass.endTime,
      };
      if (!timeRangeChecks.check(effective)) {
        return res.status(400).json({ error: timeRangeChecks.message });
      }

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

      const instructorClasses = await storage.getClassesByInstructor(effective.instructorId);
      const conflict = findInstructorConflict(instructorClasses, effective, [classId]);
      if (conflict) {
        return res.status(409).json({
          error: `Conflito de horário: o professor já tem aula das ${conflict.startTime} às ${conflict.endTime} neste dia.`,
        });
      }

      const updated = await storage.updateClass(classId, updateData);
      if (!updated) return res.status(404).json({ error: 'Turma não encontrada' });
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update class error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
