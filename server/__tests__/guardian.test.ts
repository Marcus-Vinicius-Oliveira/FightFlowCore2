import { describe, it, expect } from 'vitest';
import { calculateAge, isMinor, guardianRequirementError } from '../../shared/schema';

// Data de referência fixa: 05/07/2026 (UTC) — testes independentes do relógio
const REF = new Date(Date.UTC(2026, 6, 5));

describe('calculateAge', () => {
  it('calcula idade completa em anos', () => {
    expect(calculateAge(new Date(Date.UTC(2000, 6, 5)), REF)).toBe(26);
  });

  it('não completa a idade antes do aniversário do ano', () => {
    // Aniversário em 06/07 — um dia depois da referência
    expect(calculateAge(new Date(Date.UTC(2008, 6, 6)), REF)).toBe(17);
  });

  it('completa a idade exatamente no dia do aniversário', () => {
    expect(calculateAge(new Date(Date.UTC(2008, 6, 5)), REF)).toBe(18);
  });

  it('trata mês anterior e posterior corretamente', () => {
    expect(calculateAge(new Date(Date.UTC(2008, 5, 30)), REF)).toBe(18); // junho já passou
    expect(calculateAge(new Date(Date.UTC(2008, 7, 1)), REF)).toBe(17); // agosto ainda não chegou
  });
});

describe('isMinor', () => {
  it('menor de 18 anos é menor de idade', () => {
    expect(isMinor(new Date(Date.UTC(2010, 2, 10)), REF)).toBe(true);
  });

  it('quem faz 18 hoje já é maior de idade', () => {
    expect(isMinor(new Date(Date.UTC(2008, 6, 5)), REF)).toBe(false);
  });

  it('aceita string ISO (formato enviado pelos formulários)', () => {
    expect(isMinor('2010-03-10', REF)).toBe(true);
    expect(isMinor('1990-01-01', REF)).toBe(false);
  });

  it('sem data de nascimento (ou inválida) não é tratado como menor', () => {
    expect(isMinor(undefined, REF)).toBe(false);
    expect(isMinor(null, REF)).toBe(false);
    expect(isMinor('', REF)).toBe(false);
    expect(isMinor('data-invalida', REF)).toBe(false);
  });
});

describe('guardianRequirementError', () => {
  const MINOR_DOB = '2012-04-20';
  const ADULT_DOB = '1995-04-20';

  it('adulto nunca exige responsável', () => {
    expect(guardianRequirementError({ dateOfBirth: ADULT_DOB }, REF)).toBeNull();
    expect(guardianRequirementError({ dateOfBirth: undefined }, REF)).toBeNull();
  });

  it('menor sem nome do responsável retorna erro do nome', () => {
    expect(guardianRequirementError({ dateOfBirth: MINOR_DOB }, REF))
      .toBe('Aluno menor de idade: informe o nome do responsável legal');
  });

  it('nome só com espaços não conta como preenchido', () => {
    expect(guardianRequirementError({ dateOfBirth: MINOR_DOB, guardianName: '   ' }, REF))
      .toBe('Aluno menor de idade: informe o nome do responsável legal');
  });

  it('menor com nome mas sem telefone retorna erro do telefone', () => {
    expect(guardianRequirementError({ dateOfBirth: MINOR_DOB, guardianName: 'Maria Souza' }, REF))
      .toBe('Aluno menor de idade: informe o telefone do responsável legal');
  });

  it('menor com nome e telefone é válido', () => {
    expect(guardianRequirementError({
      dateOfBirth: MINOR_DOB,
      guardianName: 'Maria Souza',
      guardianPhone: '(11) 98888-7777',
    }, REF)).toBeNull();
  });

  it('aceita Date além de string (formato do banco no PATCH)', () => {
    expect(guardianRequirementError({ dateOfBirth: new Date(Date.UTC(2012, 3, 20)) }, REF))
      .toBe('Aluno menor de idade: informe o nome do responsável legal');
  });

  it('limpar o responsável de um menor (null) volta a ser inválido', () => {
    expect(guardianRequirementError({
      dateOfBirth: MINOR_DOB,
      guardianName: null,
      guardianPhone: null,
    }, REF)).toBe('Aluno menor de idade: informe o nome do responsável legal');
  });
});
