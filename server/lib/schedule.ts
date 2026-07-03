import type { Class } from "@shared/schema";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeFormat(time: string): boolean {
  return TIME_RE.test(time);
}

// Comparação lexicográfica é suficiente para HH:MM zero-padded.
// Aulas consecutivas (fim de uma = início da outra) não conflitam.
export function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && startB < endA;
}

export interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Procura, entre as turmas existentes do professor, alguma que conflite com o
 * slot proposto. `excludeIds` permite ignorar os registros da própria turma
 * durante uma edição.
 */
export function findInstructorConflict(
  instructorClasses: Class[],
  slot: ScheduleSlot,
  excludeIds: string[] = [],
): Class | undefined {
  return instructorClasses.find(c =>
    !excludeIds.includes(c.id) &&
    c.dayOfWeek === slot.dayOfWeek &&
    timesOverlap(c.startTime, c.endTime, slot.startTime, slot.endTime)
  );
}
