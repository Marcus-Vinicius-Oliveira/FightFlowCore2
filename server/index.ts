import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startOverduePaymentsJob } from "./jobs/markOverduePayments";
import { db } from "./db";
import { users } from "@shared/schema";
import { isNull, or, eq, and } from "drizzle-orm";

const app = express();

// Atrás de proxy reverso (Replit/NGINX) o rate limit precisa do IP real do
// cliente via X-Forwarded-For; sem isso todos compartilham o IP do proxy.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers — CSP disabled in dev (Vite injects inline scripts for HMR)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

// CORS — restrict to known frontend origin in production
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigin : true,
  credentials: true,
}));

// Global rate limiter — bypassed em dev para localhost
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 0, // 0 = ilimitado
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  skip: () => process.env.NODE_ENV !== 'production',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check — must be before auth middleware
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      // Never log response body — may contain tokens or PII
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

async function backfillStudentBelts() {
  try {
    const result = await db.update(users)
      .set({ belt: 'branca' })
      .where(and(eq(users.role, 'ALUNO'), or(isNull(users.belt), eq(users.belt, ''))));
    log(`Belt backfill: updated students with missing belt to 'branca'`);
  } catch (e) {
    console.error('Belt backfill failed:', e);
  }
}

(async () => {
  await backfillStudentBelts();
  const server = await registerRoutes(app);
  startOverduePaymentsJob();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message || 'Internal Server Error';

    res.status(status).json({ error: message });
    if (status >= 500) console.error(err);
  });

  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: '0.0.0.0' }, () => {
    log(`serving on port ${port}`);
  });
})();
