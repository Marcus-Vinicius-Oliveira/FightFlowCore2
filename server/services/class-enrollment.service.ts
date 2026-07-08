import { db } from "../db";
import { and, eq, inArray } from "drizzle-orm";
import { classes, enrollments, users, membershipPlans, type Enrollment } from "@shared/schema";
import { ensureModalityEnrollment } from "./modality-enrollment.service";

/**
 * Matrícula/remoção em grupo: uma "turma" na UI é um grupo de registros no banco
 * (um por dia da semana). Estes serviços operam o grupo inteiro em uma única
 * transação/statement, eliminando o N+1 de rede e o estado meio-matriculado
 * de requests parciais.
 */

export type GroupEnrollResult =
  | {
      ok: true;
      created: Enrollment[];
      skippedClassIds: string[];
      modalityAdded: boolean;
      modalityName: string | null;
    }
  | { ok: false; status: number; error: string };

export async function enrollStudentInClassGroup(params: {
  studentId: string;
  membershipPlanId: string;
  classIds: string[];
  academyId: string;
  actorId: string;
  startDate?: Date;
}): Promise<GroupEnrollResult> {
  const { studentId, membershipPlanId, academyId, actorId } = params;
  const classIds = [...new Set(params.classIds)];

  const classRows = await db.query.classes.findMany({
    where: inArray(classes.id, classIds),
    with: { classType: true },
  });
  if (classRows.length !== classIds.length || classRows.some(c => c.academyId !== academyId)) {
    return { ok: false, status: 404, error: 'Turma não encontrada' };
  }
  if (classRows.some(c => !c.active)) {
    return { ok: false, status: 400, error: 'Não é possível matricular em uma turma desativada' };
  }
  const classTypeIds = new Set(classRows.map(c => c.classTypeId));
  if (classTypeIds.size !== 1) {
    return { ok: false, status: 400, error: 'Todos os registros devem pertencer à mesma turma' };
  }

  const [student] = await db.select().from(users).where(eq(users.id, studentId));
  if (!student || student.academyId !== academyId || student.role !== 'ALUNO') {
    return { ok: false, status: 400, error: 'Aluno não encontrado ou não pertence à sua academia' };
  }
  if (!student.active) {
    return { ok: false, status: 400, error: 'Aluno desativado não pode ser matriculado' };
  }

  const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, membershipPlanId));
  if (!plan || plan.academyId !== academyId) {
    return { ok: false, status: 400, error: 'Plano de mensalidade não encontrado na sua academia' };
  }

  // Ignora registros em que o aluno já está ativo (rematrícula parcial é idempotente)
  const existing = await db.select({ classId: enrollments.classId })
    .from(enrollments)
    .where(and(
      eq(enrollments.studentId, studentId),
      inArray(enrollments.classId, classIds),
      eq(enrollments.active, true),
    ));
  const skipped = new Set(existing.map(r => r.classId));
  const toCreate = classIds.filter(id => !skipped.has(id));
  const startDate = params.startDate ?? new Date();

  const { created, modalityAdded } = await db.transaction(async tx => {
    const created = toCreate.length
      ? await tx.insert(enrollments)
          .values(toCreate.map(classId => ({
            studentId,
            classId,
            membershipPlanId,
            startDate,
            active: true,
            updatedBy: actorId,
          })))
          .returning()
      : [];

    // Matrícula em turma implica vínculo com a modalidade da turma
    // (cria graduação inicial se o aluno ainda não tem rank nela).
    const { added } = await ensureModalityEnrollment({
      studentId,
      academyId,
      classTypeId: classRows[0].classTypeId,
      actorId,
      enrolledAt: startDate,
    }, tx);

    return { created, modalityAdded: added };
  });

  return {
    ok: true,
    created,
    skippedClassIds: [...skipped],
    modalityAdded,
    modalityName: classRows[0].classType?.name ?? null,
  };
}

export type GroupUnenrollResult =
  | { ok: true; removed: number }
  | { ok: false; status: number; error: string };

export async function unenrollStudentFromClassGroup(params: {
  studentId: string;
  classIds: string[];
  academyId: string;
  actorId: string;
}): Promise<GroupUnenrollResult> {
  const { studentId, academyId, actorId } = params;
  const classIds = [...new Set(params.classIds)];

  const classRows = await db.select({ id: classes.id, academyId: classes.academyId })
    .from(classes)
    .where(inArray(classes.id, classIds));
  if (classRows.length !== classIds.length || classRows.some(c => c.academyId !== academyId)) {
    return { ok: false, status: 404, error: 'Turma não encontrada' };
  }

  // Um único UPDATE encerra o grupo inteiro (atômico por construção)
  const result = await db.update(enrollments)
    .set({ active: false, endDate: new Date(), updatedBy: actorId })
    .where(and(
      eq(enrollments.studentId, studentId),
      inArray(enrollments.classId, classIds),
      eq(enrollments.active, true),
    ));

  const removed = result.rowCount ?? 0;
  if (removed === 0) {
    return { ok: false, status: 404, error: 'Matrícula não encontrada' };
  }
  return { ok: true, removed };
}
