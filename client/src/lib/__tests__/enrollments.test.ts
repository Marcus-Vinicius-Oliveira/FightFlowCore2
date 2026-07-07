import { describe, it, expect } from 'vitest';
import {
  mergeGroupEnrollments,
  missingEnrollmentIds,
  occupancyText,
  formatDaysShort,
  groupStudentEnrollments,
  type StudentEnrollmentRecord,
} from '../enrollments';

describe('mergeGroupEnrollments — matrículas de um grupo de registros (um por dia)', () => {
  it('deduplica aluno matriculado em vários dias, guardando todos os classIds', () => {
    const result = mergeGroupEnrollments([
      { classId: 'seg', enrollments: [{ studentId: 's1', studentName: 'Ana', studentEmail: 'ana@x.com' }] },
      { classId: 'qua', enrollments: [{ studentId: 's1', studentName: 'Ana', studentEmail: 'ana@x.com' }] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].studentId).toBe('s1');
    expect(result[0].enrolledClassIds.sort()).toEqual(['qua', 'seg']);
  });

  it('mantém alunos diferentes e ordena por nome', () => {
    const result = mergeGroupEnrollments([
      { classId: 'seg', enrollments: [
        { studentId: 's2', studentName: 'Bruno', studentEmail: 'b@x.com' },
        { studentId: 's1', studentName: 'Ana', studentEmail: 'a@x.com' },
      ]},
    ]);
    expect(result.map(r => r.studentName)).toEqual(['Ana', 'Bruno']);
  });

  it('retorna vazio quando não há matrículas', () => {
    expect(mergeGroupEnrollments([{ classId: 'seg', enrollments: [] }])).toEqual([]);
  });

  it('aluno matriculado em só um dia do grupo aparece com apenas esse classId (dados legados)', () => {
    const result = mergeGroupEnrollments([
      { classId: 'seg', enrollments: [{ studentId: 's1', studentName: 'Ana', studentEmail: 'a@x.com' }] },
      { classId: 'qua', enrollments: [] },
    ]);
    expect(result[0].enrolledClassIds).toEqual(['seg']);
  });
});

describe('missingEnrollmentIds — registros do grupo onde o aluno ainda não está matriculado', () => {
  it('retorna todos os ids para aluno não matriculado', () => {
    expect(missingEnrollmentIds(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('retorna só os ids faltantes para matrícula parcial (dados legados)', () => {
    expect(missingEnrollmentIds(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('retorna vazio quando já matriculado em todos', () => {
    expect(missingEnrollmentIds(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});

describe('occupancyText — contagem de alunos matriculados', () => {
  it('mostra "N alunos" no plural', () => {
    expect(occupancyText(14)).toBe('14 alunos');
    expect(occupancyText(0)).toBe('0 alunos');
  });

  it('singular para exatamente 1 matriculado', () => {
    expect(occupancyText(1)).toBe('1 aluno');
  });
});

describe('groupStudentEnrollments — turmas do aluno a partir dos registros por dia', () => {
  const rec = (over: Partial<StudentEnrollmentRecord['class']> & { classId: string }): StudentEnrollmentRecord => ({
    id: `e-${over.classId}`,
    classId: over.classId,
    class: {
      id: over.classId,
      classTypeId: over.classTypeId ?? 'ct1',
      classTypeName: over.classTypeName ?? 'BJJ',
      instructorId: over.instructorId ?? 'i1',
      instructorName: over.instructorName ?? 'Prof. João',
      dayOfWeek: over.dayOfWeek ?? 1,
      startTime: over.startTime ?? '19:00',
      endTime: over.endTime ?? '20:00',
    },
  });

  it('agrupa registros da mesma turma (modalidade+professor+horário) e junta os dias', () => {
    const groups = groupStudentEnrollments([
      rec({ classId: 'seg', dayOfWeek: 1 }),
      rec({ classId: 'qua', dayOfWeek: 3 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].daysOfWeek).toEqual([1, 3]);
    expect(groups[0].classIds.sort()).toEqual(['qua', 'seg']);
  });

  it('separa turmas com horários diferentes', () => {
    const groups = groupStudentEnrollments([
      rec({ classId: 'a', startTime: '19:00' }),
      rec({ classId: 'b', startTime: '07:00', dayOfWeek: 2 }),
    ]);
    expect(groups).toHaveLength(2);
    // ordenadas por horário de início
    expect(groups[0].startTime).toBe('07:00');
  });

  it('ignora registros sem dados da turma (turma removida)', () => {
    const broken = { id: 'e1', classId: 'x', class: null };
    expect(groupStudentEnrollments([broken as unknown as StudentEnrollmentRecord])).toEqual([]);
  });
});

describe('formatDaysShort — dias da semana abreviados em pt-BR', () => {
  it('formata e ordena os dias', () => {
    expect(formatDaysShort([3, 1, 5])).toBe('Seg, Qua, Sex');
  });

  it('domingo e sábado', () => {
    expect(formatDaysShort([6, 0])).toBe('Dom, Sáb');
  });

  it('vazio retorna string vazia', () => {
    expect(formatDaysShort([])).toBe('');
  });
});
