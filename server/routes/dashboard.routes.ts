import { Router } from "express";
import { eq, and, gte, count, sum, sql } from "drizzle-orm";
import { db } from "../db";
import { users, payments, attendance, classes } from "@shared/schema";
import { storage } from "../storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";
import { graduationRanks, graduationSystems, studentModalityRanks, classTypes } from "@shared/schema";

const router = Router();

// GET /api/dashboard/info
router.get('/info',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const [academy, totalStudents, totalInstructors, classTypesList] = await Promise.all([
        storage.getAcademy(academyId),
        storage.countUsersByAcademy(academyId, 'ALUNO'),
        storage.countUsersByAcademy(academyId, 'PROFESSOR'),
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
          totalStudents,
          totalInstructors,
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

        // `status` é a fonte de verdade — o campo legado `present` não era
        // preenchido pela rota de presença até jul/2026 e zerava a taxa.
        db.select({ count: count() }).from(attendance)
          .where(and(
            eq(attendance.academyId, academyId),
            gte(attendance.date, thirtyDaysAgo),
            eq(attendance.status, 'presente'),
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

// GET /api/dashboard/charts
router.get('/charts',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const [growthRows, revenueRows, beltRows, modalityRows] = await Promise.all([
        // Novos alunos por mês (últimos 6 meses)
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS count
          FROM users
          WHERE academy_id = ${academyId}::uuid
            AND role = 'ALUNO'
            AND created_at >= ${sixMonthsAgo}::timestamp
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at)
        `),

        // Receita por mês (últimos 6 meses)
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', paid_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount), 0)::bigint AS total
          FROM payments
          WHERE academy_id = ${academyId}::uuid
            AND status = 'paid'
            AND paid_date >= ${sixMonthsAgo}::timestamp
          GROUP BY DATE_TRUNC('month', paid_date)
          ORDER BY DATE_TRUNC('month', paid_date)
        `),

        // Distribuição de faixas (alunos ativos) — normalizado para minúsculas
        db.execute(sql`
          SELECT LOWER(belt) AS belt, COUNT(*)::int AS count
          FROM users
          WHERE academy_id = ${academyId}::uuid
            AND role = 'ALUNO'
            AND active = true
            AND belt IS NOT NULL
            AND belt <> ''
          GROUP BY LOWER(belt)
          ORDER BY count DESC
        `),

        // Distribuição de graduações por modalidade (student_modality_ranks)
        db.execute(sql`
          SELECT
            ct.name   AS modality,
            gr.name   AS rank,
            gr.color_class AS color_class,
            gr.display_order AS display_order,
            COUNT(smr.id)::int AS count
          FROM student_modality_ranks smr
          JOIN class_types ct   ON ct.id  = smr.class_type_id
          JOIN graduation_ranks gr ON gr.id = smr.rank_id
          JOIN graduation_systems gs ON gs.id = gr.system_id
          WHERE smr.academy_id = ${academyId}::uuid
          GROUP BY ct.name, gr.name, gr.color_class, gr.display_order
          ORDER BY ct.name, gr.display_order
        `),
      ]);

      res.json({
        studentGrowth: growthRows.rows.map(r => ({
          month: r.month as string,
          count: Number(r.count),
        })),
        monthlyRevenue: revenueRows.rows.map(r => ({
          month: r.month as string,
          total: Number(r.total),
        })),
        beltDistribution: beltRows.rows.map(r => ({
          belt: r.belt as string,
          count: Number(r.count),
        })),
        modalityRankDistribution: modalityRows.rows.map(r => ({
          modality: r.modality as string,
          rank: r.rank as string,
          colorClass: r.color_class as string,
          displayOrder: Number(r.display_order),
          count: Number(r.count),
        })),
      });
    } catch (error) {
      console.error('Dashboard charts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
