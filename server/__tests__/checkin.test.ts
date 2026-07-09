import { describe, it, expect, vi } from 'vitest';

// O módulo lê JWT_SECRET na assinatura do HMAC — precisa existir antes do import
process.env.JWT_SECRET = 'a'.repeat(64);

// Mock router-level dependencies so we can import the module without a real DB
vi.mock('../storage', () => ({ storage: {} }));
vi.mock('../auth', () => ({
  authenticateToken: vi.fn(),
  requireRole: vi.fn(() => vi.fn()),
  requireSameAcademy: vi.fn(),
}));

import {
  makeCheckinToken,
  makeStaticCheckinToken,
  verifyCheckinToken,
  isClassHappeningNow,
  CHECKIN_SLOT_MS,
} from '../routes/checkin.routes';

const ACADEMY = '11111111-2222-3333-4444-555555555555';

describe('makeCheckinToken / verifyCheckinToken', () => {
  it('token recém-gerado é aceito para a mesma academia', () => {
    const now = new Date('2026-07-08T19:00:00');
    const { token } = makeCheckinToken(ACADEMY, now);
    expect(verifyCheckinToken(token, now)).toEqual({ ok: true, academyId: ACADEMY, kind: 'dynamic' });
  });

  it('token continua válido no slot seguinte (tolerância de 1 slot)', () => {
    const now = new Date('2026-07-08T19:00:00');
    const { token } = makeCheckinToken(ACADEMY, now);
    const later = new Date(now.getTime() + CHECKIN_SLOT_MS);
    expect(verifyCheckinToken(token, later)).toEqual({ ok: true, academyId: ACADEMY, kind: 'dynamic' });
  });

  it('token expira depois de 2 slots (foto antiga do QR não vale)', () => {
    const now = new Date('2026-07-08T19:00:00');
    const { token } = makeCheckinToken(ACADEMY, now);
    const later = new Date(now.getTime() + 2 * CHECKIN_SLOT_MS);
    expect(verifyCheckinToken(token, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('assinatura adulterada é rejeitada como inválida', () => {
    const now = new Date('2026-07-08T19:00:00');
    const { token } = makeCheckinToken(ACADEMY, now);
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${'0'.repeat(24)}`;
    expect(verifyCheckinToken(tampered, now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('trocar a academia do token invalida a assinatura', () => {
    const now = new Date('2026-07-08T19:00:00');
    const { token } = makeCheckinToken(ACADEMY, now);
    const parts = token.split('.');
    const otherAcademy = '99999999-8888-7777-6666-555555555555';
    const forged = `${otherAcademy}.${parts[1]}.${parts[2]}`;
    expect(verifyCheckinToken(forged, now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('slot futuro (relógio adulterado no cliente) é rejeitado como inválido', () => {
    const future = new Date('2026-07-08T19:05:00');
    const { token } = makeCheckinToken(ACADEMY, future);
    const now = new Date('2026-07-08T19:00:00');
    expect(verifyCheckinToken(token, now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('lixo e formatos truncados são inválidos, não lançam exceção', () => {
    const now = new Date('2026-07-08T19:00:00');
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', `${ACADEMY}.notanumber.${'0'.repeat(24)}`]) {
      expect(verifyCheckinToken(bad, now)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('expiresInSeconds fica entre 60 e 120 segundos', () => {
    const { expiresInSeconds } = makeCheckinToken(ACADEMY);
    expect(expiresInSeconds).toBeGreaterThanOrEqual(60);
    expect(expiresInSeconds).toBeLessThanOrEqual(120);
  });
});

describe('makeStaticCheckinToken / verifyCheckinToken (QR fixo)', () => {
  it('token estático é aceito e devolve a versão para a rota comparar', () => {
    const token = makeStaticCheckinToken(ACADEMY, 3);
    expect(verifyCheckinToken(token)).toEqual({
      ok: true, academyId: ACADEMY, kind: 'static', version: 3,
    });
  });

  it('token estático não expira com o tempo (é a versão que o invalida)', () => {
    const token = makeStaticCheckinToken(ACADEMY, 1);
    const muitoDepois = new Date('2030-01-01T12:00:00');
    expect(verifyCheckinToken(token, muitoDepois)).toMatchObject({ ok: true, kind: 'static' });
  });

  it('adulterar a versão invalida a assinatura (não dá para "voltar" a versão)', () => {
    const token = makeStaticCheckinToken(ACADEMY, 2);
    const forged = token.replace('.s.2.', '.s.1.');
    expect(verifyCheckinToken(forged)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('assinatura adulterada é rejeitada', () => {
    const parts = makeStaticCheckinToken(ACADEMY, 1).split('.');
    const tampered = `${parts[0]}.s.${parts[2]}.${'0'.repeat(24)}`;
    expect(verifyCheckinToken(tampered)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('token dinâmico continua identificado como dynamic', () => {
    const { token } = makeCheckinToken(ACADEMY);
    expect(verifyCheckinToken(token)).toMatchObject({ ok: true, kind: 'dynamic' });
  });
});

describe('isClassHappeningNow', () => {
  // 2026-07-08 é uma quarta-feira (getDay() === 3)
  const wed = (time: string) => new Date(`2026-07-08T${time}:00`);
  const cls = { dayOfWeek: 3, startTime: '19:00', endTime: '20:00' };

  it('aceita durante a aula', () => {
    expect(isClassHappeningNow(cls, wed('19:30'))).toBe(true);
  });

  it('aceita a partir de 30min antes do início', () => {
    expect(isClassHappeningNow(cls, wed('18:30'))).toBe(true);
    expect(isClassHappeningNow(cls, wed('18:29'))).toBe(false);
  });

  it('aceita até o horário de término, não depois', () => {
    expect(isClassHappeningNow(cls, wed('20:00'))).toBe(true);
    expect(isClassHappeningNow(cls, wed('20:01'))).toBe(false);
  });

  it('rejeita em outro dia da semana, mesmo no horário certo', () => {
    const thu = new Date('2026-07-09T19:30:00'); // quinta
    expect(isClassHappeningNow(cls, thu)).toBe(false);
  });
});
