import rateLimit from "express-rate-limit";

// Mesmo critério do limiter global (server/index.ts): fora de produção os
// limites são desativados — sem isso, execuções repetidas dos e2e (que criam
// academias via signup) esbarram no 429 em poucos minutos.
const skipOutsideProduction = () => process.env.NODE_ENV !== 'production';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  skip: skipOutsideProduction,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.' },
  skip: skipOutsideProduction,
});
