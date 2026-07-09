import { Router } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { format } from "date-fns";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

// ─── Token rotativo do QR ─────────────────────────────────────────────────────
// O QR da recepção codifica um token HMAC amarrado à academia e à janela de
// tempo atual (slot de 60s). O aluno que escaneia prova presença física: uma
// foto antiga do QR expira em no máximo 2 slots. Reutiliza o JWT_SECRET — não
// há motivo para um segundo segredo só para isto.

export const CHECKIN_SLOT_MS = 60_000;

// Aceita o slot atual e o anterior: um QR recém-escaneado nunca expira no
// meio do fluxo (validade efetiva de 60–120s).
const CHECKIN_SLOT_TOLERANCE = 1;

// Aluno pode fazer check-in a partir de 30min antes do início da aula, até o fim.
export const CHECKIN_EARLY_TOLERANCE_MIN = 30;

function signSlot(academyId: string, slot: number): string {
  return createHmac("sha256", process.env.JWT_SECRET!)
    .update(`checkin:${academyId}:${slot}`)
    .digest("hex")
    .slice(0, 24);
}

export function makeCheckinToken(academyId: string, now: Date = new Date()): {
  token: string;
  expiresInSeconds: number;
} {
  const slot = Math.floor(now.getTime() / CHECKIN_SLOT_MS);
  const token = `${academyId}.${slot}.${signSlot(academyId, slot)}`;
  // Válido até o fim do slot seguinte (tolerância de 1 slot na verificação)
  const expiresAtMs = (slot + 1 + CHECKIN_SLOT_TOLERANCE) * CHECKIN_SLOT_MS;
  return { token, expiresInSeconds: Math.ceil((expiresAtMs - now.getTime()) / 1000) };
}

export type CheckinTokenResult =
  | { ok: true; academyId: string }
  | { ok: false; reason: "invalid" | "expired" };

export function verifyCheckinToken(token: string, now: Date = new Date()): CheckinTokenResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "invalid" };
  const [academyId, slotStr, sig] = parts;
  const slot = Number(slotStr);
  if (!Number.isInteger(slot) || !/^[0-9a-f]{24}$/.test(sig)) {
    return { ok: false, reason: "invalid" };
  }

  const expected = signSlot(academyId, slot);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "invalid" };
  }

  const currentSlot = Math.floor(now.getTime() / CHECKIN_SLOT_MS);
  if (slot > currentSlot) return { ok: false, reason: "invalid" }; // slot futuro = token forjado
  if (currentSlot - slot > CHECKIN_SLOT_TOLERANCE) return { ok: false, reason: "expired" };
  return { ok: true, academyId };
}

// ─── Resolução da turma pela grade ────────────────────────────────────────────

export interface ClassWindow {
  dayOfWeek: number; // 0 = domingo (mesma convenção do schema)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function isClassHappeningNow(cls: ClassWindow, now: Date): boolean {
  if (cls.dayOfWeek !== now.getDay()) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(cls.startTime);
  const end = timeToMinutes(cls.endTime);
  return nowMin >= start - CHECKIN_EARLY_TOLERANCE_MIN && nowMin <= end;
}

// ─── Rotas ────────────────────────────────────────────────────────────────────

// GET /api/checkin/qr-token — token para a tela de QR da recepção
router.get(
  "/qr-token",
  authenticateToken,
  requireRole(["ADMIN_ACADEMIA", "PROFESSOR"]),
  async (req: AuthenticatedRequest, res) => {
    const { token, expiresInSeconds } = makeCheckinToken(req.user!.academyId!);
    res.json({ token, expiresInSeconds });
  }
);

// POST /api/checkin — aluno registra a própria presença escaneando o QR
router.post(
  "/",
  authenticateToken,
  requireRole(["ALUNO"]),
  async (req: AuthenticatedRequest, res) => {
    try {
      const bodySchema = z.object({
        token: z.string().min(1),
        classId: z.string().uuid().optional(),
      });
      const { token, classId } = bodySchema.parse(req.body);

      const verified = verifyCheckinToken(token);
      if (!verified.ok) {
        return verified.reason === "expired"
          ? res.status(410).json({ error: "QR Code expirado. Escaneie o código atual na recepção." })
          : res.status(400).json({ error: "QR Code inválido." });
      }
      if (verified.academyId !== req.user!.academyId) {
        return res.status(403).json({ error: "Este QR Code pertence a outra academia." });
      }

      const now = new Date();
      const enrollmentsList = await storage.getEnrollmentsByStudentWithClass(req.user!.id);
      const candidates = enrollmentsList
        .map(e => e.class)
        .filter((c): c is NonNullable<typeof c> => !!c && c.active !== false)
        .filter(c => isClassHappeningNow(c, now));

      if (candidates.length === 0) {
        return res.status(422).json({
          error: "Nenhuma das suas aulas está acontecendo agora. O check-in abre 30 minutos antes do início.",
        });
      }

      const chosen = classId
        ? candidates.find(c => c.id === classId)
        : candidates.length === 1
          ? candidates[0]
          : undefined;

      if (classId && !chosen) {
        return res.status(422).json({ error: "Esta aula não está acontecendo agora." });
      }

      // Mais de uma aula na janela (ex.: duas modalidades no mesmo horário):
      // devolve as opções para o aluno escolher no portal.
      if (!chosen) {
        return res.json({
          requiresChoice: true,
          options: candidates.map(c => ({
            classId: c.id,
            name: c.classType?.name ?? "Aula",
            startTime: c.startTime,
            endTime: c.endTime,
            instructor: c.instructor?.name,
          })),
        });
      }

      // Mesma convenção de data do fluxo do professor (AttendanceControl):
      // string local yyyy-MM-dd coercida para Date — assim o registro do
      // check-in e o da chamada manual caem no mesmo dia e não duplicam.
      const recordDate = new Date(format(now, "yyyy-MM-dd"));
      const existing = await storage.getAttendanceByStudentClassAndDate(
        req.user!.id,
        chosen.id,
        recordDate
      );

      const classInfo = {
        className: chosen.classType?.name ?? "Aula",
        startTime: chosen.startTime,
        endTime: chosen.endTime,
      };

      if (existing) {
        if (existing.status === "presente") {
          return res.json({ checkedIn: true, alreadyCheckedIn: true, ...classInfo });
        }
        // Havia falta/justificado pré-lançado — o aluno está aqui, corrige.
        await storage.updateAttendance(existing.id, {
          status: "presente",
          present: true,
          notes: "Check-in via QR Code",
        });
        return res.json({ checkedIn: true, ...classInfo });
      }

      await storage.createAttendance({
        studentId: req.user!.id,
        classId: chosen.id,
        academyId: req.user!.academyId!,
        date: recordDate,
        status: "presente",
        present: true,
        notes: "Check-in via QR Code",
      });
      res.status(201).json({ checkedIn: true, ...classInfo });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Erro de validação", details: error.errors });
      }
      console.error("Checkin error:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  }
);

export default router;
