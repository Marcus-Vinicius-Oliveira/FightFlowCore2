import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";
import { lastMonthKeys, monthsWindowStart, fillMonthlySeries } from "../lib/reports";

const router = Router();

// GET /api/reports/overview?months=6|12&attendanceDays=30|90
// Relatórios gerenciais da academia: faturamento, inadimplência, crescimento
// de alunos e frequência por turma. Só admin — dados financeiros.
router.get('/overview',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const months = z.coerce.number().refine(m => [6, 12].includes(m)).catch(12).parse(req.query.months);
      const attendanceDays = z.coerce.number().refine(d => [30, 90].includes(d)).catch(30).parse(req.query.attendanceDays);

      const now = new Date();
      const windowStart = monthsWindowStart(now, months);
      const attendanceStart = new Date(now.getTime() - attendanceDays * 24 * 60 * 60 * 1000);

      const [
        revenueRows,
        overdueRows,
        topDebtorRows,
        newStudentRows,
        cancellationRows,
        activeStudentsRows,
        attendanceByClassRows,
      ] = await Promise.all([
        // Receita paga por mês (mês do pagamento, não do vencimento)
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', paid_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount), 0)::bigint AS revenue
          FROM payments
          WHERE academy_id = ${academyId}::uuid
            AND status = 'paid'
            AND paid_date >= ${windowStart}::timestamp
          GROUP BY 1
          ORDER BY 1
        `),

        // Em aberto vencido, agrupado pelo mês do vencimento. `status <> 'paid'`
        // em vez de `= 'overdue'`: entre execuções do job de inadimplência uma
        // mensalidade vencida ainda pode constar como pending.
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', due_date), 'YYYY-MM') AS month,
            COALESCE(SUM(amount), 0)::bigint AS overdue_amount,
            COUNT(DISTINCT student_id)::int AS overdue_students
          FROM payments
          WHERE academy_id = ${academyId}::uuid
            AND status <> 'paid'
            AND due_date >= ${windowStart}::timestamp
            AND due_date < ${now}::timestamp
          GROUP BY 1
          ORDER BY 1
        `),

        // Maiores devedores (todas as mensalidades vencidas em aberto, sem
        // limite de janela — dívida antiga é justamente a mais relevante)
        db.execute(sql`
          SELECT
            u.id AS student_id,
            u.name AS name,
            COALESCE(SUM(p.amount), 0)::bigint AS total,
            COUNT(*)::int AS count
          FROM payments p
          JOIN users u ON u.id = p.student_id
          WHERE p.academy_id = ${academyId}::uuid
            AND p.status <> 'paid'
            AND p.due_date < ${now}::timestamp
          GROUP BY u.id, u.name
          ORDER BY total DESC
          LIMIT 10
        `),

        // Novos alunos por mês
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS count
          FROM users
          WHERE academy_id = ${academyId}::uuid
            AND role = 'ALUNO'
            AND created_at >= ${windowStart}::timestamp
          GROUP BY 1
          ORDER BY 1
        `),

        // Cancelamentos por mês — deactivated_at só existe desde jul/2026;
        // desativações anteriores não aparecem (série começa zerada)
        db.execute(sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', deactivated_at), 'YYYY-MM') AS month,
            COUNT(*)::int AS count
          FROM users
          WHERE academy_id = ${academyId}::uuid
            AND role = 'ALUNO'
            AND active = false
            AND deactivated_at >= ${windowStart}::timestamp
          GROUP BY 1
          ORDER BY 1
        `),

        db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM users
          WHERE academy_id = ${academyId}::uuid AND role = 'ALUNO' AND active = true
        `),

        // Frequência por turma no período. LEFT JOIN a partir das turmas
        // ativas: turma sem chamada aparece zerada — é sinal, não ruído.
        db.execute(sql`
          SELECT
            c.id AS class_id,
            ct.name AS class_type_name,
            c.day_of_week AS day_of_week,
            c.start_time AS start_time,
            c.end_time AS end_time,
            COUNT(a.id)::int AS total,
            COUNT(a.id) FILTER (WHERE a.status = 'presente')::int AS present
          FROM classes c
          JOIN class_types ct ON ct.id = c.class_type_id
          LEFT JOIN attendance a
            ON a.class_id = c.id
           AND a.academy_id = ${academyId}::uuid
           AND a.date >= ${attendanceStart}::timestamp
          WHERE c.academy_id = ${academyId}::uuid
            AND c.active = true
          GROUP BY c.id, ct.name, c.day_of_week, c.start_time, c.end_time
          ORDER BY ct.name, c.day_of_week, c.start_time
        `),
      ]);

      const keys = lastMonthKeys(now, months);
      const revenue = fillMonthlySeries(
        keys,
        revenueRows.rows.map(r => ({ month: r.month as string, revenue: Number(r.revenue) })),
        { revenue: 0 },
      );
      const overdue = fillMonthlySeries(
        keys,
        overdueRows.rows.map(r => ({
          month: r.month as string,
          overdueAmount: Number(r.overdue_amount),
          overdueStudents: Number(r.overdue_students),
        })),
        { overdueAmount: 0, overdueStudents: 0 },
      );
      const newStudents = fillMonthlySeries(
        keys,
        newStudentRows.rows.map(r => ({ month: r.month as string, count: Number(r.count) })),
        { count: 0 },
      );
      const cancellations = fillMonthlySeries(
        keys,
        cancellationRows.rows.map(r => ({ month: r.month as string, count: Number(r.count) })),
        { count: 0 },
      );

      res.json({
        months,
        monthly: keys.map((month, i) => ({
          month,
          revenue: revenue[i].revenue,
          overdueAmount: overdue[i].overdueAmount,
          overdueStudents: overdue[i].overdueStudents,
          newStudents: newStudents[i].count,
          cancellations: cancellations[i].count,
        })),
        topDebtors: topDebtorRows.rows.map(r => ({
          studentId: r.student_id as string,
          name: r.name as string,
          total: Number(r.total),
          count: Number(r.count),
        })),
        activeStudents: Number(activeStudentsRows.rows[0]?.count ?? 0),
        attendance: {
          days: attendanceDays,
          classes: attendanceByClassRows.rows.map(r => {
            const total = Number(r.total);
            const present = Number(r.present);
            return {
              classId: r.class_id as string,
              classTypeName: r.class_type_name as string,
              dayOfWeek: Number(r.day_of_week),
              startTime: r.start_time as string,
              endTime: r.end_time as string,
              total,
              present,
              rate: total > 0 ? Math.round((present / total) * 100) : null,
            };
          }),
        },
      });
    } catch (error) {
      console.error('Reports overview error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
