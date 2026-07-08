import { db } from "../db";
import { and, asc, eq } from "drizzle-orm";
import {
  studentModalityEnrollments,
  studentModalityRanks,
  studentRankHistory,
  graduationSystems,
  graduationRanks,
  type StudentModalityEnrollment,
} from "@shared/schema";

/** Executor de queries: o `db` global ou uma transação aberta (mesma API). */
export type Dbx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Garante que o aluno tem vínculo ativo com a modalidade (student_modality_enrollments)
 * e uma graduação inicial caso ainda não tenha rank nela.
 *
 * Regra de modelagem: toda matrícula em turma implica vínculo com a modalidade da
 * turma; o vínculo pode existir sem turma (aula particular, legado), nunca o inverso.
 *
 * Aceita uma transação como executor para compor operações atômicas.
 */
export async function ensureModalityEnrollment(params: {
  studentId: string;
  academyId: string;
  classTypeId: string;
  actorId: string;
  enrolledAt?: Date;
}, dbx: Dbx = db): Promise<{ enrollment: StudentModalityEnrollment; added: boolean }> {
  const { studentId, academyId, classTypeId, actorId } = params;
  const enrolledAt = params.enrolledAt ?? new Date();

  const [alreadyActive] = await dbx.select({ id: studentModalityEnrollments.id })
    .from(studentModalityEnrollments)
    .where(and(
      eq(studentModalityEnrollments.studentId, studentId),
      eq(studentModalityEnrollments.classTypeId, classTypeId),
      eq(studentModalityEnrollments.active, true),
    ));

  const [enrollment] = await dbx.insert(studentModalityEnrollments)
    .values({ studentId, academyId, classTypeId, enrolledAt, active: true })
    .onConflictDoUpdate({
      target: [studentModalityEnrollments.studentId, studentModalityEnrollments.classTypeId],
      set: { active: true, updatedAt: new Date() },
    })
    .returning();

  const [hasRank] = await dbx.select({ id: studentModalityRanks.id })
    .from(studentModalityRanks)
    .where(and(
      eq(studentModalityRanks.studentId, studentId),
      eq(studentModalityRanks.classTypeId, classTypeId),
    ));

  if (!hasRank) {
    const [firstRank] = await dbx.select({ id: graduationRanks.id })
      .from(graduationRanks)
      .innerJoin(graduationSystems, eq(graduationSystems.id, graduationRanks.systemId))
      .where(and(
        eq(graduationSystems.academyId, academyId),
        eq(graduationSystems.classTypeId, classTypeId),
      ))
      .orderBy(asc(graduationRanks.displayOrder))
      .limit(1);

    if (firstRank) {
      await dbx.insert(studentModalityRanks)
        .values({ studentId, academyId, classTypeId, rankId: firstRank.id, promotedAt: enrolledAt, promotedBy: actorId })
        .onConflictDoUpdate({
          target: [studentModalityRanks.studentId, studentModalityRanks.classTypeId],
          set: { rankId: firstRank.id, promotedAt: enrolledAt, promotedBy: actorId, updatedAt: new Date() },
        });
      await dbx.insert(studentRankHistory).values({
        studentId,
        academyId,
        classTypeId,
        rankBeforeId: null,
        rankAfterId: firstRank.id,
        promotedBy: actorId,
        promotedAt: enrolledAt,
        notes: 'Graduação inicial',
      });
    }
  }

  return { enrollment, added: !alreadyActive };
}
