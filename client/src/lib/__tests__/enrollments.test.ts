import { describe, it, expect } from 'vitest';
import {
  mergeGroupEnrollments,
  missingEnrollmentIds,
  occupancy,
  formatDaysShort,
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

describe('occupancy — rótulo e estado de lotação', () => {
  it('mostra X/Y e não lotada quando há vagas', () => {
    expect(occupancy(14, 20)).toEqual({ label: '14/20', isFull: false, hasLimit: true });
  });

  it('marca lotada quando atinge a capacidade', () => {
    expect(occupancy(20, 20)).toEqual({ label: '20/20', isFull: true, hasLimit: true });
  });

  it('marca lotada quando acima da capacidade (dados legados)', () => {
    expect(occupancy(22, 20).isFull).toBe(true);
  });

  it('sem limite definido mostra só a contagem', () => {
    expect(occupancy(7, null)).toEqual({ label: '7', isFull: false, hasLimit: false });
    expect(occupancy(7, undefined)).toEqual({ label: '7', isFull: false, hasLimit: false });
    expect(occupancy(7, 0)).toEqual({ label: '7', isFull: false, hasLimit: false });
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
