import { describe, it, expect } from 'vitest';
import { timesOverlap, isValidTimeFormat, findInstructorConflict } from '../lib/schedule';
import type { Class } from '@shared/schema';

describe('isValidTimeFormat — formato HH:MM', () => {
  it('aceita horários válidos', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('08:30')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('rejeita formatos inválidos', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
    expect(isValidTimeFormat('8:30')).toBe(false);
    expect(isValidTimeFormat('08:60')).toBe(false);
    expect(isValidTimeFormat('0830')).toBe(false);
    expect(isValidTimeFormat('')).toBe(false);
    expect(isValidTimeFormat('abc')).toBe(false);
  });
});

describe('timesOverlap — sobreposição de intervalos HH:MM', () => {
  it('detecta sobreposição parcial', () => {
    expect(timesOverlap('08:00', '09:00', '08:30', '09:30')).toBe(true);
  });

  it('detecta intervalo contido no outro', () => {
    expect(timesOverlap('08:00', '10:00', '08:30', '09:00')).toBe(true);
  });

  it('detecta intervalos idênticos', () => {
    expect(timesOverlap('08:00', '09:00', '08:00', '09:00')).toBe(true);
  });

  it('não considera conflito aulas consecutivas (fim de uma = início da outra)', () => {
    expect(timesOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
    expect(timesOverlap('09:00', '10:00', '08:00', '09:00')).toBe(false);
  });

  it('não considera conflito intervalos disjuntos', () => {
    expect(timesOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
  });
});

function makeClass(overrides: Partial<Class>): Class {
  return {
    id: 'c1',
    academyId: 'a1',
    classTypeId: 'ct1',
    instructorId: 'i1',
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '09:00',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('findInstructorConflict — conflito de agenda do professor', () => {
  const existing = [
    makeClass({ id: 'seg-manha', dayOfWeek: 1, startTime: '08:00', endTime: '09:00' }),
    makeClass({ id: 'qua-noite', dayOfWeek: 3, startTime: '19:00', endTime: '20:30' }),
  ];

  it('acusa conflito no mesmo dia com horário sobreposto', () => {
    const conflict = findInstructorConflict(existing, { dayOfWeek: 1, startTime: '08:30', endTime: '09:30' });
    expect(conflict?.id).toBe('seg-manha');
  });

  it('não acusa conflito em dia diferente com mesmo horário', () => {
    expect(findInstructorConflict(existing, { dayOfWeek: 2, startTime: '08:00', endTime: '09:00' })).toBeUndefined();
  });

  it('não acusa conflito no mesmo dia em horário livre', () => {
    expect(findInstructorConflict(existing, { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' })).toBeUndefined();
  });

  it('ignora a própria turma ao editar (excludeIds)', () => {
    const conflict = findInstructorConflict(
      existing,
      { dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
      ['seg-manha'],
    );
    expect(conflict).toBeUndefined();
  });
});
