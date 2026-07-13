/**
 * Agregação dos relatórios gerenciais — fonte única de verdade consumida
 * tanto pela rota JSON (/api/reports/overview) quanto pela exportação em
 * Excel (/api/reports/export): os números do arquivo nunca divergem da tela.
 *
 * Vive separado de ./reports (helpers puros) porque importa o db, que exige
 * DATABASE_URL no import — os testes unitários dos helpers não carregam .env.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { lastMonthKeys, monthsWindowStart, fillMonthlySeries } from "./reports";

export interface ReportsOverview {
  months: number;
  monthly: Array<{
    month: string; // YYYY-MM
    revenue: number;
    overdueAmount: number;
    overdueStudents: number;
    newStudents: number;
    cancellations: number;
  }>;
  topDebtors: Array<{ studentId: string; name: string; phone: string | null; total: number; count: number }>;
  activeStudents: number;
  attendance: {
    days: number;
    classes: Array<{
      classId: string;
      classTypeName: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      total: number;
      present: number;
      rate: number | null;
    }>;
  };
}

export async function getReportsOverview(
  academyId: string,
  months: number,
  attendanceDays: number,
  now = new Date(),
): Promise<ReportsOverview> {
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
        u.phone AS phone,
        COALESCE(SUM(p.amount), 0)::bigint AS total,
        COUNT(*)::int AS count
      FROM payments p
      JOIN users u ON u.id = p.student_id
      WHERE p.academy_id = ${academyId}::uuid
        AND p.status <> 'paid'
        AND p.due_date < ${now}::timestamp
      GROUP BY u.id, u.name, u.phone
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

  return {
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
      phone: (r.phone as string | null) ?? null,
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
  };
}
