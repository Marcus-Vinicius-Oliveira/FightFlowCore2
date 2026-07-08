import { storage } from "../storage";
import type { StudentModalityEnrollment } from "@shared/schema";

/**
 * Garante que o aluno tem vínculo ativo com a modalidade (student_modality_enrollments)
 * e uma graduação inicial caso ainda não tenha rank nela.
 *
 * Regra de modelagem: toda matrícula em turma implica vínculo com a modalidade da
 * turma; o vínculo pode existir sem turma (aula particular, legado), nunca o inverso.
 */
export async function ensureModalityEnrollment(params: {
  studentId: string;
  academyId: string;
  classTypeId: string;
  actorId: string;
  enrolledAt?: Date;
}): Promise<{ enrollment: StudentModalityEnrollment; added: boolean }> {
  const { studentId, academyId, classTypeId, actorId } = params;
  const enrolledAt = params.enrolledAt ?? new Date();

  const existing = await storage.getStudentModalityEnrollments(studentId);
  const alreadyActive = existing.some(e => e.classTypeId === classTypeId);

  const enrollment = await storage.upsertStudentModalityEnrollment({
    studentId,
    academyId,
    classTypeId,
    enrolledAt,
    active: true,
  });

  const existingRanks = await storage.getStudentModalityRanks(studentId);
  const hasRank = existingRanks.some(r => r.classTypeId === classTypeId);
  if (!hasRank) {
    const systems = await storage.getGraduationSystemsByAcademy(academyId);
    const system = systems.find(s => s.classTypeId === classTypeId);
    if (system) {
      const ranks = await storage.getGraduationRanksBySystem(system.id);
      const firstRank = ranks.sort((a, b) => a.displayOrder - b.displayOrder)[0];
      if (firstRank) {
        await Promise.all([
          storage.upsertStudentModalityRank({
            studentId,
            academyId,
            classTypeId,
            rankId: firstRank.id,
            promotedAt: enrolledAt,
            promotedBy: actorId,
          }),
          storage.createStudentRankHistory({
            studentId,
            academyId,
            classTypeId,
            rankBeforeId: null,
            rankAfterId: firstRank.id,
            promotedBy: actorId,
            promotedAt: enrolledAt,
            notes: 'Graduação inicial',
          }),
        ]);
      }
    }
  }

  return { enrollment, added: !alreadyActive };
}
