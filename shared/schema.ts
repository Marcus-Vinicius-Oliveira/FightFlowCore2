import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, boolean, uuid, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN_ACADEMIA', 'PROFESSOR', 'ALUNO']);

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
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  academyId: uuid("academy_id").references(() => academies.id),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  belt: text("belt"),
  active: boolean("active").default(true),
  firstAccess: boolean("first_access").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academyIdIdx: index("users_academy_id_idx").on(t.academyId),
  emailIdx: index("users_email_idx").on(t.email),
  roleIdx: index("users_role_idx").on(t.role),
}));

export const membershipPlans = pgTable("membership_plans", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // in cents
  duration: integer("duration").notNull(), // days
  classesPerWeek: integer("classes_per_week"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academyIdIdx: index("membership_plans_academy_id_idx").on(t.academyId),
}));

export const classTypes = pgTable("class_types", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // minutes
  maxCapacity: integer("max_capacity"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academyIdIdx: index("class_types_academy_id_idx").on(t.academyId),
}));

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id).notNull(),
  instructorId: uuid("instructor_id").references(() => users.id).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academyIdIdx: index("classes_academy_id_idx").on(t.academyId),
  instructorIdIdx: index("classes_instructor_id_idx").on(t.instructorId),
}));

export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  membershipPlanId: uuid("membership_plan_id").references(() => membershipPlans.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  active: boolean("active").default(true),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  studentIdIdx: index("enrollments_student_id_idx").on(t.studentId),
  classIdIdx: index("enrollments_class_id_idx").on(t.classId),
}));

export const attendance = pgTable("attendance", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  classId: uuid("class_id").references(() => classes.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  date: timestamp("date").notNull(),
  present: boolean("present"),
  status: text("status").notNull().default('presente'), // 'presente', 'falta', 'justificado'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  classIdDateIdx: index("attendance_class_id_date_idx").on(t.classId, t.date),
  studentIdIdx: index("attendance_student_id_idx").on(t.studentId),
  academyIdIdx: index("attendance_academy_id_idx").on(t.academyId),
}));

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  membershipPlanId: uuid("membership_plan_id").references(() => membershipPlans.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default('pending'), // pending, paid, overdue
  notes: text("notes"),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  studentIdIdx: index("payments_student_id_idx").on(t.studentId),
  academyIdIdx: index("payments_academy_id_idx").on(t.academyId),
  statusIdx: index("payments_status_idx").on(t.status),
}));

// Platform subscription plans (managed by SUPER_ADMIN)
export const planos = pgTable("planos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  limiteAlunos: integer("limite_alunos").notNull(),
  precoMensal: integer("preco_mensal").notNull(), // in cents
  ativo: boolean("ativo").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
});

// Academy subscriptions to platform plans
export const assinaturas = pgTable("assinaturas", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academiaId: uuid("academia_id").references(() => academies.id).notNull(),
  planoId: uuid("plano_id").references(() => planos.id).notNull(),
  dataInicio: timestamp("data_inicio").notNull(),
  dataFim: timestamp("data_fim"),
  status: text("status").notNull().default('ativa'), // ativa, cancelada, teste
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academiaIdIdx: index("assinaturas_academia_id_idx").on(t.academiaId),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const academiesRelations = relations(academies, ({ many }) => ({
  users: many(users),
  membershipPlans: many(membershipPlans),
  classTypes: many(classTypes),
  classes: many(classes),
  assinaturas: many(assinaturas),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  academy: one(academies, { fields: [users.academyId], references: [academies.id] }),
  instructorClasses: many(classes, { relationName: "instructor" }),
  enrollments: many(enrollments),
  attendance: many(attendance),
  payments: many(payments),
}));

export const membershipPlansRelations = relations(membershipPlans, ({ one, many }) => ({
  academy: one(academies, { fields: [membershipPlans.academyId], references: [academies.id] }),
  enrollments: many(enrollments),
  payments: many(payments),
}));

export const classTypesRelations = relations(classTypes, ({ one, many }) => ({
  academy: one(academies, { fields: [classTypes.academyId], references: [academies.id] }),
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  academy: one(academies, { fields: [classes.academyId], references: [academies.id] }),
  classType: one(classTypes, { fields: [classes.classTypeId], references: [classTypes.id] }),
  instructor: one(users, { fields: [classes.instructorId], references: [users.id], relationName: "instructor" }),
  enrollments: many(enrollments),
  attendance: many(attendance),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, { fields: [enrollments.studentId], references: [users.id] }),
  class: one(classes, { fields: [enrollments.classId], references: [classes.id] }),
  membershipPlan: one(membershipPlans, { fields: [enrollments.membershipPlanId], references: [membershipPlans.id] }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  student: one(users, { fields: [attendance.studentId], references: [users.id] }),
  class: one(classes, { fields: [attendance.classId], references: [classes.id] }),
  academy: one(academies, { fields: [attendance.academyId], references: [academies.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  student: one(users, { fields: [payments.studentId], references: [users.id] }),
  academy: one(academies, { fields: [payments.academyId], references: [academies.id] }),
  membershipPlan: one(membershipPlans, { fields: [payments.membershipPlanId], references: [membershipPlans.id] }),
}));

export const planosRelations = relations(planos, ({ many }) => ({
  assinaturas: many(assinaturas),
}));

export const assinaturasRelations = relations(assinaturas, ({ one }) => ({
  academia: one(academies, { fields: [assinaturas.academiaId], references: [academies.id] }),
  plano: one(planos, { fields: [assinaturas.planoId], references: [planos.id] }),
}));

// ─── Insert schemas ────────────────────────────────────────────────────────────

export const insertAcademySchema = createInsertSchema(academies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassTypeSchema = createInsertSchema(classTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEnrollmentSchema = createInsertSchema(enrollments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPlanoSchema = createInsertSchema(planos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssinaturaSchema = createInsertSchema(assinaturas).omit({ id: true, createdAt: true, updatedAt: true });

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Student creation schema used by admin panels
export const studentCreateSchema = insertUserSchema
  .omit({ role: true, academyId: true, active: true, firstAccess: true })
  .extend({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    role: z.literal('ALUNO').default('ALUNO'),
    firstAccess: z.literal(true).default(true),
    active: z.literal(true).default(true),
    dateOfBirth: z.string().optional().transform(s => s ? new Date(s) : undefined),
  });

export const studentCreateFormSchema = studentCreateSchema
  .omit({ dateOfBirth: true })
  .extend({ dateOfBirth: z.string().optional() });

export type StudentCreateData = z.infer<typeof studentCreateSchema>;
export type StudentCreateFormData = z.infer<typeof studentCreateFormSchema>;
