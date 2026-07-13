import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { academies } from "@shared/schema";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../auth";
import { getReportsOverview } from "../lib/reports-overview";
import { buildReportsWorkbook } from "../lib/reports-xlsx";

const router = Router();

const monthsSchema = z.coerce.number().refine(m => [6, 12].includes(m)).catch(12);
const attendanceDaysSchema = z.coerce.number().refine(d => [30, 90].includes(d)).catch(30);

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

      const months = monthsSchema.parse(req.query.months);
      const attendanceDays = attendanceDaysSchema.parse(req.query.attendanceDays);

      res.json(await getReportsOverview(academyId, months, attendanceDays));
    } catch (error) {
      console.error('Reports overview error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/reports/export?months=6|12&attendanceDays=30|90
// Mesmos números da tela (mesma agregação) em .xlsx, uma aba por seção.
router.get('/export',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório para este recurso' });

      const months = monthsSchema.parse(req.query.months);
      const attendanceDays = attendanceDaysSchema.parse(req.query.attendanceDays);

      const [overview, [academy]] = await Promise.all([
        getReportsOverview(academyId, months, attendanceDays),
        db.select({ name: academies.name, slug: academies.slug }).from(academies).where(eq(academies.id, academyId)),
      ]);

      const workbook = buildReportsWorkbook(overview, academy?.name ?? 'Academia');
      const buffer = await workbook.xlsx.writeBuffer();

      const date = new Date().toISOString().slice(0, 10);
      const filename = `relatorios-${academy?.slug ?? 'academia'}-${months}meses-${date}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Reports export error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
