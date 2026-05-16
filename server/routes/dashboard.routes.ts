import { Router } from "express";
import { eq, and, gte, count, sum } from "drizzle-orm";
import { db } from "../db";
import { users, payments, attendance, classes } from "@shared/schema";
import { storage } from "../storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";

const router = Router();

// GET /api/dashboard/info
router.get('/info',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const [academy, students, instructors, classTypesList] = await Promise.all([
        storage.getAcademy(academyId),
        storage.getUsersByAcademy(academyId, 'ALUNO'),
        storage.getUsersByAcademy(academyId, 'PROFESSOR'),
        storage.getClassTypesByAcademy(academyId),
      ]);

      if (!academy) return res.status(404).json({ error: 'Academia não encontrada' });

      res.json({
        academy: {
          id: academy.id,
          name: academy.name,
          slug: academy.slug,
          email: academy.email,
          createdAt: academy.createdAt,
        },
        statistics: {
          totalStudents: students.length,
          totalInstructors: instructors.length,
          totalClassTypes: classTypesList.length,
        },
        message: `Bem-vindo ao painel da ${academy.name}`,
      });
    } catch (error) {
      console.error('Dashboard info error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/dashboard/stats
router.get('/stats',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        revenueThisMonth,
        overduePayments,
        attendanceTotal,
        attendancePresent,
        activeClasses,
      ] = await Promise.all([
        db.select({ count: count() }).from(users)
          .where(and(eq(users.academyId, academyId), eq(users.role, 'ALUNO'))),

        db.select({ count: count() }).from(users)
          .where(and(eq(users.academyId, academyId), eq(users.role, 'ALUNO'), eq(users.active, true))),

        db.select({ count: count() }).from(users)
          .where(and(eq(users.academyId, academyId), eq(users.role, 'ALUNO'), gte(users.createdAt, startOfMonth))),

        db.select({ total: sum(payments.amount) }).from(payments)
          .where(and(
            eq(payments.academyId, academyId),
            eq(payments.status, 'paid'),
            gte(payments.paidDate, startOfMonth),
          )),

        db.select({ count: count(), total: sum(payments.amount) }).from(payments)
          .where(and(eq(payments.academyId, academyId), eq(payments.status, 'overdue'))),

        db.select({ count: count() }).from(attendance)
          .where(and(eq(attendance.academyId, academyId), gte(attendance.date, thirtyDaysAgo))),

        db.select({ count: count() }).from(attendance)
          .where(and(
            eq(attendance.academyId, academyId),
            gte(attendance.date, thirtyDaysAgo),
            eq(attendance.present, true),
          )),

        db.select({ count: count() }).from(classes)
          .where(and(eq(classes.academyId, academyId), eq(classes.active, true))),
      ]);

      const totalAtt = Number(attendanceTotal[0]?.count ?? 0);
      const presentAtt = Number(attendancePresent[0]?.count ?? 0);
      const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;

      res.json({
        students: {
          total: Number(totalStudents[0]?.count ?? 0),
          active: Number(activeStudents[0]?.count ?? 0),
          newThisMonth: Number(newStudentsThisMonth[0]?.count ?? 0),
        },
        financial: {
          revenueThisMonth: Number(revenueThisMonth[0]?.total ?? 0),
          overdueCount: Number(overduePayments[0]?.count ?? 0),
          overdueAmount: Number(overduePayments[0]?.total ?? 0),
        },
        attendance: {
          rateThisMonth: attendanceRate,
          totalRecords: totalAtt,
        },
        classes: {
          activeTotal: Number(activeClasses[0]?.count ?? 0),
        },
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
