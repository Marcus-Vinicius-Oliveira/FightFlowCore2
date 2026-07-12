// Fractional indexing para ordenação manual em colunas Kanban: mover um card
// custa UM update (a posição vira a média dos vizinhos), sem renumerar a
// coluna. Doubles têm ~52 bits de mantissa — na prática nunca esgota para
// um pipeline de academia.

export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return 0;
  if (prev === undefined) return next! - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

/**
 * Posição para um card que acabou de ser colocado no índice `index` de uma
 * coluna (lista já na ordem final, com o card incluído).
 */
export function positionAtIndex(positions: number[], index: number): number {
  const prev = index > 0 ? positions[index - 1] : undefined;
  const next = index < positions.length - 1 ? positions[index + 1] : undefined;
  return positionBetween(prev, next);
}
