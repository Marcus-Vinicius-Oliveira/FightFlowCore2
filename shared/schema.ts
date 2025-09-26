import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, uuid, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for user roles
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN_ACADEMIA', 'PROFESSOR', 'ALUNO']);

// Academies table (tenants)
export const academies = pgTable("academies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  description: text("description"),
  logo: text("logo"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users table with role-based access
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  academyId: uuid("academy_id").references(() => academies.id), // Nullable for SUPER_ADMIN
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  belt: text("belt"), // Graduation/belt field for students
  active: boolean("active").default(true),
  firstAccess: boolean("first_access").default(true), // Flag for mandatory password change
  createdAt: timestamp("created_at").defaultNow(),
});

// Membership plans
export const membershipPlans = pgTable("membership_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  name: text("name").notNull(), // e.g., "Monthly 3x/week"
  description: text("description"),
  price: integer("price").notNull(), // in cents
  duration: integer("duration").notNull(), // days
  classesPerWeek: integer("classes_per_week"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Class types (e.g., Jiu-Jitsu, Karate, etc.)
export const classTypes = pgTable("class_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  name: text("name").notNull(), // e.g., "Jiu-Jitsu Adulto"
  description: text("description"),
  duration: integer("duration").notNull(), // minutes
  maxCapacity: integer("max_capacity"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Scheduled classes
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id).notNull(),
  instructorId: uuid("instructor_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: text("start_time").notNull(), // e.g., "18:00"
  endTime: text("end_time").notNull(), // e.g., "19:30"
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Student enrollments in classes
export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  membershipPlanId: uuid("membership_plan_id").references(() => membershipPlans.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance tracking (Presencas)
export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  date: timestamp("date").notNull(),
  present: boolean("present"), // legacy field, keeping for compatibility
  status: text("status").notNull().default('presente'), // 'presente', 'falta', 'justificado'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment tracking
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  membershipPlanId: uuid("membership_plan_id").references(() => membershipPlans.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default('pending'), // pending, paid, overdue
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Super Admin tables for SaaS management

// Platform subscription plans (managed by super admin)
export const planos = pgTable("planos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(), // e.g., "Faixa Branca", "Beta Gratuito"
  limiteAlunos: integer("limite_alunos").notNull(),
  precoMensal: integer("preco_mensal").notNull(), // in cents
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Academy subscriptions to platform plans
export const assinaturas = pgTable("assinaturas", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academiaId: uuid("academia_id").references(() => academies.id).notNull(),
  planoId: uuid("plano_id").references(() => planos.id).notNull(),
  dataInicio: timestamp("data_inicio").notNull(),
  dataFim: timestamp("data_fim"), // can be null for active subscriptions
  status: text("status").notNull().default('ativa'), // ativa, cancelada, teste
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const academiesRelations = relations(academies, ({ many }) => ({
  users: many(users),
  membershipPlans: many(membershipPlans),
  classTypes: many(classTypes),
  classes: many(classes),
  assinaturas: many(assinaturas),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  academy: one(academies, {
    fields: [users.academyId],
    references: [academies.id],
  }),
  instructorClasses: many(classes, { relationName: "instructor" }),
  enrollments: many(enrollments),
  attendance: many(attendance),
  payments: many(payments),
}));

export const membershipPlansRelations = relations(membershipPlans, ({ one, many }) => ({
  academy: one(academies, {
    fields: [membershipPlans.academyId],
    references: [academies.id],
  }),
  enrollments: many(enrollments),
  payments: many(payments),
}));

export const classTypesRelations = relations(classTypes, ({ one, many }) => ({
  academy: one(academies, {
    fields: [classTypes.academyId],
    references: [academies.id],
  }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  academy: one(academies, {
    fields: [classes.academyId],
    references: [academies.id],
  }),
  classType: one(classTypes, {
    fields: [classes.classTypeId],
    references: [classTypes.id],
  }),
  instructor: one(users, {
    fields: [classes.instructorId],
    references: [users.id],
    relationName: "instructor",
  }),
  enrollments: many(enrollments),
  attendance: many(attendance),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [enrollments.classId],
    references: [classes.id],
  }),
  membershipPlan: one(membershipPlans, {
    fields: [enrollments.membershipPlanId],
    references: [membershipPlans.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(users, {
    fields: [attendance.studentId],
    references: [users.id],
  }),
  class: one(classes, {
    fields: [attendance.classId],
    references: [classes.id],
  }),
  academy: one(academies, {
    fields: [attendance.academyId],
    references: [academies.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(users, {
    fields: [payments.studentId],
    references: [users.id],
  }),
  membershipPlan: one(membershipPlans, {
    fields: [payments.membershipPlanId],
    references: [membershipPlans.id],
  }),
}));

// Super Admin table relations
export const planosRelations = relations(planos, ({ many }) => ({
  assinaturas: many(assinaturas),
}));

export const assinaturasRelations = relations(assinaturas, ({ one }) => ({
  academia: one(academies, {
    fields: [assinaturas.academiaId],
    references: [academies.id],
  }),
  plano: one(planos, {
    fields: [assinaturas.planoId],
    references: [planos.id],
  }),
}));

// Insert schemas
export const insertAcademySchema = createInsertSchema(academies).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({
  id: true,
  createdAt: true,
});

export const insertClassTypeSchema = createInsertSchema(classTypes).omit({
  id: true,
  createdAt: true,
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
  createdAt: true,
});

export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});

// Super Admin insert schemas
export const insertPlanoSchema = createInsertSchema(planos).omit({
  id: true,
  createdAt: true,
});

export const insertAssinaturaSchema = createInsertSchema(assinaturas).omit({
  id: true,
  createdAt: true,
});

// Types
export type Academy = typeof academies.$inferSelect;
export type User = typeof users.$inferSelect;
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type ClassType = typeof classTypes.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Plano = typeof planos.$inferSelect;
export type Assinatura = typeof assinaturas.$inferSelect;

// DTOs with relations (for API responses)
export type ClassWithRefs = Class & {
  classType?: ClassType;
  instructor?: User;
};

export type EnrollmentWithRefs = Enrollment & {
  student?: User;
  class?: Class;
  membershipPlan?: MembershipPlan;
};

export type InsertAcademy = z.infer<typeof insertAcademySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;
export type InsertClassType = z.infer<typeof insertClassTypeSchema>;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type InsertEnrollment = z.infer<typeof insertEnrollmentSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type InsertPlano = z.infer<typeof insertPlanoSchema>;
export type InsertAssinatura = z.infer<typeof insertAssinaturaSchema>;

// Student creation schema - specific schema for creating students from admin panels
export const studentCreateSchema = insertUserSchema
  .omit({
    role: true,
    academyId: true, 
    active: true,
    firstAccess: true,
  })
  .extend({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    role: z.literal('ALUNO').default('ALUNO'),
    firstAccess: z.literal(true).default(true),
    active: z.literal(true).default(true),
    dateOfBirth: z.string().optional().transform(s => s ? new Date(s) : undefined),
  });

// Form schema for frontend - accepts string date that will be transformed
export const studentCreateFormSchema = studentCreateSchema
  .omit({ dateOfBirth: true })
  .extend({
    dateOfBirth: z.string().optional(),
  });

export type StudentCreateData = z.infer<typeof studentCreateSchema>;
export type StudentCreateFormData = z.infer<typeof studentCreateFormSchema>;