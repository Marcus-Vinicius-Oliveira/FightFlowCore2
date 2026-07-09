import { Router } from "express";
import { z } from "zod";
import { eq, and, gte, lt, count, sum, sql } from "drizzle-orm";
import { db } from "../db";
import { users, payments, attendance, classes } from "@shared/schema";
import { storage } from "../storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";
import { graduationRanks, graduationSystems, studentModalityRanks, studentModalityEnrollments, classTypes } from "@shared/schema";
import { classifyRetention, RETENTION_ATTENTION_DAYS, RETENTION_RISK_DAYS } from "../lib/retention";
import { suggestGraduations, GRADUATION_MIN_DAYS_IN_RANK, GRADUATION_MIN_PRESENCES } from "../lib/graduation-suggestion";

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
      res.status(500).json({ error: 'Erro interno do servidor' });
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
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        revenueThisMonth,
        overduePayments,
        attendanceTotal,
        attendancePresent,
        activeClasses,
        attendancePrevTotal,
        attendancePrevPresent,
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

        // Janela anterior (60→30 dias atrás) — dá contexto de tendência à taxa
        db.select({ count: count() }).from(attendance)
          .where(and(
            eq(attendance.academyId, academyId),
            gte(attendance.date, sixtyDaysAgo),
            lt(attendance.date, thirtyDaysAgo),
          )),
        db.select({ count: count() }).from(attendance)
          .where(and(
            eq(attendance.academyId, academyId),
            gte(attendance.date, sixtyDaysAgo),
            lt(attendance.date, thirtyDaysAgo),
            eq(attendance.status, 'presente'),
          )),
      ]);

      const totalAtt = Number(attendanceTotal[0]?.count ?? 0);
      const presentAtt = Number(attendancePresent[0]?.count ?? 0);
      const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;
      const prevTotalAtt = Number(attendancePrevTotal[0]?.count ?? 0);
      const prevPresentAtt = Number(attendancePrevPresent[0]?.count ?? 0);
      const attendancePrevRate = prevTotalAtt > 0 ? Math.round((prevPresentAtt / prevTotalAtt) * 100) : null;

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
          ratePreviousMonth: attendancePrevRate,
          totalRecords: totalAtt,
        },
        classes: {
          activeTotal: Number(activeClasses[0]?.count ?? 0),
        },
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
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

      const [growthRows, revenueRows, beltRows, modalityRows, unrankedRows] = await Promise.all([
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

        // Distribuição de graduações por modalidade — parte do sistema de
        // graduação (todas as faixas, mesmo sem alunos) e conta via LEFT JOIN.
        // Faixas zeradas são informação de pipeline, não ausência de dado.
        // Inclui os IDs para permitir navegação do dashboard à lista de alunos filtrada.
        db.execute(sql`
          SELECT
            ct.id     AS class_type_id,
            ct.name   AS modality,
            gr.id     AS rank_id,
            gr.name   AS rank,
            gr.color_class AS color_class,
            gr.display_order AS display_order,
            COUNT(smr.id)::int AS count
          FROM graduation_systems gs
          JOIN class_types ct   ON ct.id = gs.class_type_id
          JOIN graduation_ranks gr ON gr.system_id = gs.id
          LEFT JOIN student_modality_ranks smr
            ON smr.rank_id = gr.id
           AND smr.class_type_id = ct.id
           AND smr.academy_id = ${academyId}::uuid
          WHERE gs.academy_id = ${academyId}::uuid
            AND gs.class_type_id IS NOT NULL
          GROUP BY ct.id, ct.name, gr.id, gr.name, gr.color_class, gr.display_order
          ORDER BY ct.name, gr.display_order
        `),

        // Alunos ativos matriculados na modalidade mas SEM graduação registrada
        // — sinal de cadastro incompleto, exibido ao final da lista no dashboard
        db.execute(sql`
          SELECT
            e.class_type_id AS class_type_id,
            COUNT(*)::int   AS count
          FROM student_modality_enrollments e
          JOIN users u ON u.id = e.student_id
          WHERE e.academy_id = ${academyId}::uuid
            AND e.active = true
            AND u.active = true
            AND NOT EXISTS (
              SELECT 1 FROM student_modality_ranks smr
              WHERE smr.student_id = e.student_id
                AND smr.class_type_id = e.class_type_id
            )
          GROUP BY e.class_type_id
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
          classTypeId: r.class_type_id as string,
          modality: r.modality as string,
          rankId: r.rank_id as string,
          rank: r.rank as string,
          colorClass: r.color_class as string,
          displayOrder: Number(r.display_order),
          count: Number(r.count),
        })),
        modalityUnranked: unrankedRows.rows.map(r => ({
          classTypeId: r.class_type_id as string,
          count: Number(r.count),
        })),
      });
    } catch (error) {
      console.error('Dashboard charts error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/dashboard/retention — alunos ativos sem presença há 14/30+ dias.
// Opt-in por academia (Configurações → Painel): desligado, devolve só
// { enabled: false } sem rodar a query.
router.get('/retention',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const academy = await storage.getAcademy(academyId);
      if (!academy?.dashboardShowRetention) {
        return res.json({ enabled: false });
      }

      const rows = await storage.getRetentionRows(academyId);
      const { entries, counts } = classifyRetention(rows);

      res.json({
        enabled: true,
        attentionDays: RETENTION_ATTENTION_DAYS,
        riskDays: RETENTION_RISK_DAYS,
        counts,
        // Só quem precisa de ação (attention/risk) — já ordenado dos piores para os melhores
        students: entries.filter(e => e.bucket !== 'ok'),
      });
    } catch (error) {
      console.error('Dashboard retention error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/dashboard/preferences — preferências de exibição do painel
router.get('/preferences',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });
      const academy = await storage.getAcademy(academyId);
      if (!academy) return res.status(404).json({ error: 'Academia não encontrada' });
      res.json({
        showRetention: academy.dashboardShowRetention,
        showGraduationSuggestions: academy.dashboardShowGraduationSuggestions,
        showAttendanceRate: academy.dashboardShowAttendanceRate,
      });
    } catch (error) {
      console.error('Dashboard preferences error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// PATCH /api/dashboard/preferences — só admin altera
router.patch('/preferences',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const prefs = z.object({
        showRetention: z.boolean().optional(),
        showGraduationSuggestions: z.boolean().optional(),
        showAttendanceRate: z.boolean().optional(),
      }).refine(
        p => p.showRetention !== undefined
          || p.showGraduationSuggestions !== undefined
          || p.showAttendanceRate !== undefined,
        { message: 'Informe ao menos uma preferência' },
      ).parse(req.body);

      const updated = await storage.updateAcademy(academyId, {
        ...(prefs.showRetention !== undefined && { dashboardShowRetention: prefs.showRetention }),
        ...(prefs.showGraduationSuggestions !== undefined && { dashboardShowGraduationSuggestions: prefs.showGraduationSuggestions }),
        ...(prefs.showAttendanceRate !== undefined && { dashboardShowAttendanceRate: prefs.showAttendanceRate }),
      });
      if (!updated) return res.status(404).json({ error: 'Academia não encontrada' });
      res.json({
        showRetention: updated.dashboardShowRetention,
        showGraduationSuggestions: updated.dashboardShowGraduationSuggestions,
        showAttendanceRate: updated.dashboardShowAttendanceRate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Erro de validação', details: error.errors });
      }
      console.error('Update dashboard preferences error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/dashboard/graduation-suggestions — candidatos a promoção por modalidade
// (tempo na faixa + presenças desde a última promoção). Opt-in por academia
// (Configurações → Painel): desligado, devolve só { enabled: false } sem query.
router.get('/graduation-suggestions',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const academy = await storage.getAcademy(academyId);
      if (!academy?.dashboardShowGraduationSuggestions) {
        return res.json({ enabled: false });
      }

      const rows = await storage.getGraduationCandidateRows(academyId);
      res.json({
        enabled: true,
        minDaysInRank: GRADUATION_MIN_DAYS_IN_RANK,
        minPresences: GRADUATION_MIN_PRESENCES,
        suggestions: suggestGraduations(rows),
      });
    } catch (error) {
      console.error('Dashboard graduation suggestions error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// ─── Visão de presença (/dashboard/presenca) ─────────────────────────────────

export interface AttendanceBucket {
  start: string; // yyyy-MM-dd (local)
  total: number;
  present: number;
  rate: number | null;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Agrupa registros de presença em baldes de tempo contíguos cobrindo
 * [start, end): diários para períodos curtos, semanais para longos.
 * Baldes sem registros entram zerados — o gráfico mostra o buraco em vez
 * de esconder a semana sem chamada.
 */
export function bucketAttendance(
  records: { date: Date; status: string }[],
  start: Date,
  end: Date,
  unit: 'day' | 'week',
): AttendanceBucket[] {
  const stepDays = unit === 'day' ? 1 : 7;
  const buckets: (AttendanceBucket & { startMs: number; endMs: number })[] = [];

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor < end) {
    const bucketEnd = new Date(cursor.getTime() + stepDays * 24 * 60 * 60 * 1000);
    buckets.push({
      start: localDateStr(cursor),
      startMs: cursor.getTime(),
      endMs: Math.min(bucketEnd.getTime(), end.getTime()),
      total: 0,
      present: 0,
      rate: null,
    });
    cursor.setTime(bucketEnd.getTime());
  }

  for (const r of records) {
    const t = r.date.getTime();
    const bucket = buckets.find(b => t >= b.startMs && t < b.endMs);
    if (!bucket) continue;
    bucket.total++;
    if (r.status === 'presente') bucket.present++;
  }

  return buckets.map(({ startMs: _s, endMs: _e, ...b }) => ({
    ...b,
    rate: b.total > 0 ? Math.round((b.present / b.total) * 100) : null,
  }));
}

// GET /api/dashboard/attendance-overview?days=7|30|90
router.get('/attendance-overview',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const days = z.coerce.number().refine(d => [7, 30, 90].includes(d)).catch(30).parse(req.query.days);
      const now = new Date();
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const prevStart = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000);

      const [records, prevCounts, students, lastPresences, modalityRows, classTypeRows] = await Promise.all([
        // Registros do período atual — agregações feitas em memória (uma
        // academia gera centenas de registros/mês, não milhões)
        db.select({ studentId: attendance.studentId, date: attendance.date, status: attendance.status })
          .from(attendance)
          .where(and(eq(attendance.academyId, academyId), gte(attendance.date, start))),

        // Período anterior: só os totais, para a comparação
        db.select({
          total: count(),
          present: count(sql`case when ${attendance.status} = 'presente' then 1 end`),
        })
          .from(attendance)
          .where(and(
            eq(attendance.academyId, academyId),
            gte(attendance.date, prevStart),
            lt(attendance.date, start),
          )),

        // Todos os alunos ativos — quem não tem registro algum é justamente
        // o caso de risco que a página existe para mostrar
        db.select({ id: users.id, name: users.name })
          .from(users)
          .where(and(eq(users.academyId, academyId), eq(users.role, 'ALUNO'), eq(users.active, true))),

        // Última presença de todos os tempos (não só do período) — alimenta
        // o "sem presença há X dias"
        db.select({ studentId: attendance.studentId, last: sql<string>`max(${attendance.date})` })
          .from(attendance)
          .where(and(eq(attendance.academyId, academyId), eq(attendance.status, 'presente')))
          .groupBy(attendance.studentId),

        db.select({
          studentId: studentModalityEnrollments.studentId,
          classTypeId: studentModalityEnrollments.classTypeId,
        })
          .from(studentModalityEnrollments)
          .where(and(
            eq(studentModalityEnrollments.academyId, academyId),
            eq(studentModalityEnrollments.active, true),
          )),

        db.select({ id: classTypes.id, name: classTypes.name })
          .from(classTypes)
          .where(and(eq(classTypes.academyId, academyId), eq(classTypes.active, true))),
      ]);

      const total = records.length;
      const present = records.filter(r => r.status === 'presente').length;
      const prevTotal = Number(prevCounts[0]?.total ?? 0);
      const prevPresent = Number(prevCounts[0]?.present ?? 0);

      const presencesByStudent = new Map<string, number>();
      for (const r of records) {
        if (r.status !== 'presente') continue;
        presencesByStudent.set(r.studentId, (presencesByStudent.get(r.studentId) ?? 0) + 1);
      }

      const lastByStudent = new Map(lastPresences.map(r => [r.studentId, new Date(r.last)]));
      const modalitiesByStudent = new Map<string, string[]>();
      for (const m of modalityRows) {
        const list = modalitiesByStudent.get(m.studentId) ?? [];
        list.push(m.classTypeId);
        modalitiesByStudent.set(m.studentId, list);
      }

      res.json({
        days,
        rate: total > 0 ? Math.round((present / total) * 100) : null,
        totalRecords: total,
        previousRate: prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 100) : null,
        buckets: bucketAttendance(records, start, now, days === 7 ? 'day' : 'week'),
        classTypes: classTypeRows,
        students: students.map(s => {
          const last = lastByStudent.get(s.id) ?? null;
          return {
            id: s.id,
            name: s.name,
            presences: presencesByStudent.get(s.id) ?? 0,
            lastPresence: last ? last.toISOString() : null,
            daysSinceLast: last
              ? Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
              : null,
            classTypeIds: modalitiesByStudent.get(s.id) ?? [],
          };
        }),
      });
    } catch (error) {
      console.error('Dashboard attendance overview error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
