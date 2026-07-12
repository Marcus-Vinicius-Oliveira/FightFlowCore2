import type { Express } from "express";
import { createServer, type Server } from "http";

import authRouter from "./routes/auth.routes";
import studentsRouter from "./routes/students.routes";
import instructorsRouter from "./routes/instructors.routes";
import classesRouter from "./routes/classes.routes";
import attendanceRouter from "./routes/attendance.routes";
import checkinRouter from "./routes/checkin.routes";
import leadsRouter from "./routes/leads.routes";
import enrollmentsRouter from "./routes/enrollments.routes";
import financialRouter from "./routes/financial.routes";
import superadminRouter from "./routes/superadmin.routes";
import dashboardRouter from "./routes/dashboard.routes";
import usersRouter from "./routes/users.routes";
import graduationRouter from "./routes/graduation.routes";
import reportsRouter from "./routes/reports.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use('/api/auth', authRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/instructors', instructorsRouter);
  app.use('/api/classes/:classId/attendance', attendanceRouter);
  app.use('/api/classes/:classId/enrollments', enrollmentsRouter);
  app.use('/api/classes', classesRouter);
  app.use('/api/checkin', checkinRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api', financialRouter);           // /api/payments + /api/membership-plans
  app.use('/api/superadmin', superadminRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/graduation', graduationRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api', usersRouter);               // /api/users + /api/student/me

  return createServer(app);
}
