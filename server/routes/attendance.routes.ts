import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";

const router = Router({ mergeParams: true });

// O campo legado `present` precisa acompanhar `status` — o dashboard e os
// seeds antigos consultam por ele. 'justificado' é ausência abonada, não
// presença física.
export function statusToPresent(status: 'presente' | 'falta' | 'justificado'): boolean {
  return status === 'presente';
}

// GET /api/classes/:classId/attendance
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { classId } = req.params;
      const date = req.query.date as string | undefined;

      const existingClass = await storage.getClass(classId);
      if (!existingClass || existingClass.academyId !== req.user!.academyId) {
        return res.status(404).json({ error: 'Turma não encontrada' });
      }

      if (req.user!.role === 'PROFESSOR' && existingClass.instructorId !== req.user!.id) {
        return res.status(403).json({ error: 'Você só pode acessar presenças das suas turmas' });
      }

      const [enrollmentsList, attendanceRecords] = await Promise.all([
        storage.getEnrollmentsByClass(classId),
        date
          ? storage.getAttendanceByClassAndDate(classId, new Date(date))
          : storage.getAttendanceByClass(classId),
      ]);

      const studentsWithAttendance = enrollmentsList.map(enrollment => {
        const record = attendanceRecords.find(
          r => r.studentId === enrollment.studentId &&
            (!date || r.date.toDateString() === new Date(date).toDateString())
        );
        return {
          studentId: enrollment.studentId,
          studentName: enrollment.student?.name,
          studentEmail: enrollment.student?.email,
          attendance: record
            ? { id: record.id, status: record.status, notes: record.notes, date: record.date }
            : null,
        };
      });

      res.json({
        classId,
        className: existingClass.classType?.name,
        instructor: existingClass.instructor?.name,
        date,
        students: studentsWithAttendance,
      });
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/classes/:classId/attendance
router.post('/',
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

      if (req.user!.role === 'PROFESSOR' && existingClass.instructorId !== req.user!.id) {
        return res.status(403).json({ error: 'Você só pode registrar presenças nas suas turmas' });
      }

      const attendanceSchema = z.object({
        studentId: z.string().uuid(),
        date: z.coerce.date(),
        status: z.enum(['presente', 'falta', 'justificado']),
        notes: z.string().optional(),
      });

      const attendanceData = attendanceSchema.parse(req.body);

      const student = await storage.getUser(attendanceData.studentId);
      if (!student || student.academyId !== req.user!.academyId || student.role !== 'ALUNO') {
        return res.status(400).json({ error: 'Aluno não encontrado ou não pertence à sua academia' });
      }

      const enrollment = await storage.getEnrollmentByStudentAndClass(attendanceData.studentId, classId);
      if (!enrollment || !enrollment.active) {
        return res.status(400).json({ error: 'Aluno não está matriculado nesta turma' });
      }

      const dateObj = attendanceData.date;
      const existing = await storage.getAttendanceByStudentClassAndDate(attendanceData.studentId, classId, dateObj);

      const present = statusToPresent(attendanceData.status);

      let record;
      if (existing) {
        record = await storage.updateAttendance(existing.id, {
          status: attendanceData.status,
          present,
          notes: attendanceData.notes,
        });
      } else {
        record = await storage.createAttendance({
          studentId: attendanceData.studentId,
          classId,
          academyId: req.user!.academyId!,
          date: dateObj,
          status: attendanceData.status,
          present,
          notes: attendanceData.notes,
        });
      }

      res.status(existing ? 200 : 201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Record attendance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
