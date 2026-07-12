import { describe, it, expect } from 'vitest';
import { positionBetween, positionAtIndex } from '../kanban';

describe('positionBetween', () => {
  it('coluna vazia → 0', () => {
    expect(positionBetween(undefined, undefined)).toBe(0);
  });

  it('topo da coluna → antes do primeiro', () => {
    expect(positionBetween(undefined, 5)).toBe(4);
  });

  it('fim da coluna → depois do último', () => {
    expect(positionBetween(3, undefined)).toBe(4);
  });

  it('entre dois vizinhos → média', () => {
    expect(positionBetween(1, 2)).toBe(1.5);
    expect(positionBetween(-2, 4)).toBe(1);
  });
});

describe('positionAtIndex', () => {
  // Lista na ordem final, com o card recém-colocado incluído; a posição
  // dele é ignorada (calculada pelos vizinhos)
  it('início, meio e fim de uma coluna existente', () => {
    const positions = [999, 1, 2, 3]; // card no índice 0, vizinho next = 1
    expect(positionAtIndex(positions, 0)).toBe(0);
    expect(positionAtIndex([1, 999, 2], 1)).toBe(1.5);
    expect(positionAtIndex([1, 2, 999], 2)).toBe(3);
  });

  it('única carta da coluna → 0', () => {
    expect(positionAtIndex([999], 0)).toBe(0);
  });
});
