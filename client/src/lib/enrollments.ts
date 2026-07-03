// Lógica pura de matrículas em turmas agrupadas.
// Uma "turma" na UI é um grupo de registros no banco (um por dia da semana);
// matricular significa matricular em todos os registros do grupo.

export interface ClassEnrollmentRecord {
  classId: string;
  enrollments: { studentId: string; studentName?: string; studentEmail?: string }[];
}

export interface GroupEnrolledStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  /** Registros (dias) do grupo em que o aluno está de fato matriculado */
  enrolledClassIds: string[];
}

export function mergeGroupEnrollments(perClass: ClassEnrollmentRecord[]): GroupEnrolledStudent[] {
  const byStudent = new Map<string, GroupEnrolledStudent>();
  for (const { classId, enrollments } of perClass) {
    for (const e of enrollments) {
      const existing = byStudent.get(e.studentId);
      if (existing) {
        existing.enrolledClassIds.push(classId);
      } else {
        byStudent.set(e.studentId, {
          studentId: e.studentId,
          studentName: e.studentName ?? '—',
          studentEmail: e.studentEmail ?? '',
          enrolledClassIds: [classId],
        });
      }
    }
  }
  return Array.from(byStudent.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'pt-BR')
  );
}

export function missingEnrollmentIds(groupIds: string[], enrolledClassIds: string[]): string[] {
  const enrolled = new Set(enrolledClassIds);
  return groupIds.filter(id => !enrolled.has(id));
}

export interface Occupancy {
  label: string;
  isFull: boolean;
  hasLimit: boolean;
}

// maxCapacity null/undefined/0 significa "sem limite definido" (mesma regra do servidor).
export function occupancy(enrolledCount: number, maxCapacity: number | null | undefined): Occupancy {
  if (!maxCapacity) {
    return { label: String(enrolledCount), isFull: false, hasLimit: false };
  }
  return {
    label: `${enrolledCount}/${maxCapacity}`,
    isFull: enrolledCount >= maxCapacity,
    hasLimit: true,
  };
}

export interface StudentEnrollmentRecord {
  id: string;
  classId: string;
  class: {
    id: string;
    classTypeId: string;
    classTypeName?: string;
    instructorId: string;
    instructorName?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  } | null;
}

export interface StudentClassGroup {
  key: string;
  classTypeId: string;
  classTypeName: string;
  instructorName: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  /** Registros (dias) em que o aluno está matriculado nesta turma */
  classIds: string[];
}

/** Agrupa os registros de matrícula do aluno (um por dia) em turmas,
 *  com a mesma chave de agrupamento usada pelo servidor. */
export function groupStudentEnrollments(records: StudentEnrollmentRecord[]): StudentClassGroup[] {
  const groups = new Map<string, StudentClassGroup>();
  for (const rec of records) {
    if (!rec.class) continue; // turma removida — registro órfão
    const c = rec.class;
    const key = `${c.classTypeId}|${c.instructorId}|${c.startTime}|${c.endTime}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        classTypeId: c.classTypeId,
        classTypeName: c.classTypeName ?? '—',
        instructorName: c.instructorName ?? '—',
        startTime: c.startTime,
        endTime: c.endTime,
        daysOfWeek: [],
        classIds: [],
      });
    }
    const group = groups.get(key)!;
    group.daysOfWeek.push(c.dayOfWeek);
    group.classIds.push(rec.classId);
  }
  for (const g of Array.from(groups.values())) {
    g.daysOfWeek.sort((a, b) => a - b);
  }
  return Array.from(groups.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

const DAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatDaysShort(days: number[]): string {
  return [...days]
    .sort((a, b) => a - b)
    .map(d => DAY_SHORT_PT[d] ?? String(d))
    .join(', ');
}
