import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, boolean, uuid, pgEnum, index, unique } from "drizzle-orm/pg-core";
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
  paymentDueDay: integer("payment_due_day").notNull().default(5), // dia fixo de vencimento das mensalidades (1–28)
  // Painéis de inteligência do dashboard são opt-in: em academias com muitos
  // alunos as listas podem poluir o painel
  dashboardShowRetention: boolean("dashboard_show_retention").notNull().default(false),
  dashboardShowGraduationSuggestions: boolean("dashboard_show_graduation_suggestions").notNull().default(false),
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
  belt: text("belt").default('branca'),
  customMonthlyAmount: integer("custom_monthly_amount"), // centavos; desconto individual (bolsa/família) — null = valor do plano
  // Responsável legal — obrigatório quando o aluno é menor de idade (ver guardianRequirementError)
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  guardianRelationship: text("guardian_relationship"),
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
  // Modalidade do plano (cobrança por modalidade). null = geral / todas as modalidades (ex.: Passe Livre).
  classTypeId: uuid("class_type_id").references(() => classTypes.id),
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
  paymentMethod: text("payment_method"), // PIX, Dinheiro, Cartão de Débito, Cartão de Crédito
  reminderSentAt: timestamp("reminder_sent_at"), // idempotência do lembrete de vencimento
  notes: text("notes"),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  studentIdIdx: index("payments_student_id_idx").on(t.studentId),
  academyIdIdx: index("payments_academy_id_idx").on(t.academyId),
  statusIdx: index("payments_status_idx").on(t.status),
  statusDueDateIdx: index("payments_status_due_date_idx").on(t.status, t.dueDate), // job de inadimplência
  academyDueDateIdx: index("payments_academy_due_date_idx").on(t.academyId, t.dueDate), // listagem ordenada
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

// ─── Graduation System (per-modality ranks) ───────────────────────────────────

export const graduationSystems = pgTable("graduation_systems", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  academyIdIdx: index("graduation_systems_academy_id_idx").on(t.academyId),
  uniqueAcademyClassTypeName: unique("graduation_systems_academy_class_type_name_unique").on(t.academyId, t.classTypeId, t.name),
}));

export const graduationRanks = pgTable("graduation_ranks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  systemId: uuid("system_id").references(() => graduationSystems.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  colorClass: text("color_class").notNull().default('bg-gray-400 text-white'),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  systemIdIdx: index("graduation_ranks_system_id_idx").on(t.systemId),
}));

export const studentModalityRanks = pgTable("student_modality_ranks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id).notNull(),
  rankId: uuid("rank_id").references(() => graduationRanks.id).notNull(),
  promotedAt: timestamp("promoted_at").notNull().defaultNow(),
  promotedBy: uuid("promoted_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  uniqueStudentClassType: unique("student_modality_ranks_unique").on(t.studentId, t.classTypeId),
  studentIdIdx: index("student_modality_ranks_student_id_idx").on(t.studentId),
  academyIdIdx: index("student_modality_ranks_academy_id_idx").on(t.academyId),
}));

export const studentRankHistory = pgTable("student_rank_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id).notNull(),
  rankBeforeId: uuid("rank_before_id").references(() => graduationRanks.id),
  rankAfterId: uuid("rank_after_id").references(() => graduationRanks.id).notNull(),
  promotedBy: uuid("promoted_by").references(() => users.id).notNull(),
  promotedAt: timestamp("promoted_at").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  studentIdIdx: index("student_rank_history_student_id_idx").on(t.studentId),
  classTypeIdIdx: index("student_rank_history_class_type_id_idx").on(t.classTypeId),
}));

export const studentModalityEnrollments = pgTable("student_modality_enrollments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  classTypeId: uuid("class_type_id").references(() => classTypes.id).notNull(),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()),
}, (t) => ({
  uniqueStudentClassType: unique("student_modality_enrollments_unique").on(t.studentId, t.classTypeId),
  academyIdIdx: index("student_modality_enrollments_academy_id_idx").on(t.academyId),
  studentIdIdx: index("student_modality_enrollments_student_id_idx").on(t.studentId),
}));

export const beltHistory = pgTable("belt_history", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: uuid("student_id").references(() => users.id).notNull(),
  academyId: uuid("academy_id").references(() => academies.id).notNull(),
  beltBefore: text("belt_before"),
  beltAfter: text("belt_after").notNull(),
  promotedBy: uuid("promoted_by").references(() => users.id).notNull(),
  promotedAt: timestamp("promoted_at").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  studentIdIdx: index("belt_history_student_id_idx").on(t.studentId),
  academyIdIdx: index("belt_history_academy_id_idx").on(t.academyId),
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

export const beltHistoryRelations = relations(beltHistory, ({ one }) => ({
  student: one(users, { fields: [beltHistory.studentId], references: [users.id] }),
  academy: one(academies, { fields: [beltHistory.academyId], references: [academies.id] }),
  promotedByUser: one(users, { fields: [beltHistory.promotedBy], references: [users.id], relationName: "promoter" }),
}));

export const graduationSystemsRelations = relations(graduationSystems, ({ one, many }) => ({
  academy: one(academies, { fields: [graduationSystems.academyId], references: [academies.id] }),
  classType: one(classTypes, { fields: [graduationSystems.classTypeId], references: [classTypes.id] }),
  ranks: many(graduationRanks),
}));

export const graduationRanksRelations = relations(graduationRanks, ({ one }) => ({
  system: one(graduationSystems, { fields: [graduationRanks.systemId], references: [graduationSystems.id] }),
}));

export const studentModalityRanksRelations = relations(studentModalityRanks, ({ one }) => ({
  student: one(users, { fields: [studentModalityRanks.studentId], references: [users.id] }),
  academy: one(academies, { fields: [studentModalityRanks.academyId], references: [academies.id] }),
  classType: one(classTypes, { fields: [studentModalityRanks.classTypeId], references: [classTypes.id] }),
  rank: one(graduationRanks, { fields: [studentModalityRanks.rankId], references: [graduationRanks.id] }),
  promotedByUser: one(users, { fields: [studentModalityRanks.promotedBy], references: [users.id], relationName: "modalityPromoter" }),
}));

export const studentRankHistoryRelations = relations(studentRankHistory, ({ one }) => ({
  student: one(users, { fields: [studentRankHistory.studentId], references: [users.id] }),
  academy: one(academies, { fields: [studentRankHistory.academyId], references: [academies.id] }),
  classType: one(classTypes, { fields: [studentRankHistory.classTypeId], references: [classTypes.id] }),
  rankBefore: one(graduationRanks, { fields: [studentRankHistory.rankBeforeId], references: [graduationRanks.id], relationName: "rankBefore" }),
  rankAfter: one(graduationRanks, { fields: [studentRankHistory.rankAfterId], references: [graduationRanks.id], relationName: "rankAfter" }),
  promotedByUser: one(users, { fields: [studentRankHistory.promotedBy], references: [users.id], relationName: "rankHistoryPromoter" }),
}));

export const studentModalityEnrollmentsRelations = relations(studentModalityEnrollments, ({ one }) => ({
  student: one(users, { fields: [studentModalityEnrollments.studentId], references: [users.id] }),
  academy: one(academies, { fields: [studentModalityEnrollments.academyId], references: [academies.id] }),
  classType: one(classTypes, { fields: [studentModalityEnrollments.classTypeId], references: [classTypes.id] }),
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
export const insertBeltHistorySchema = createInsertSchema(beltHistory).omit({ id: true, createdAt: true });
export const insertGraduationSystemSchema = createInsertSchema(graduationSystems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGraduationRankSchema = createInsertSchema(graduationRanks).omit({ id: true, createdAt: true });
export const insertStudentModalityRankSchema = createInsertSchema(studentModalityRanks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStudentRankHistorySchema = createInsertSchema(studentRankHistory).omit({ id: true, createdAt: true });
export const insertStudentModalityEnrollmentSchema = createInsertSchema(studentModalityEnrollments).omit({ id: true, createdAt: true, updatedAt: true });

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
export type BeltHistory = typeof beltHistory.$inferSelect;
export type GraduationSystem = typeof graduationSystems.$inferSelect;
export type GraduationRank = typeof graduationRanks.$inferSelect;
export type StudentModalityRank = typeof studentModalityRanks.$inferSelect;
export type StudentRankHistory = typeof studentRankHistory.$inferSelect;
export type StudentModalityEnrollment = typeof studentModalityEnrollments.$inferSelect;

export type ClassWithRefs = Class & {
  classType?: ClassType;
  instructor?: User;
};

export type ClassGrouped = {
  /** ID representativo do primeiro registro do grupo (usado como key React e para fallback) */
  id: string;
  /** Todos os IDs do banco que compõem este grupo — necessário para delete/edit em lote */
  ids: string[];
  /** Mapeamento id → dayOfWeek para reconciliação no edit */
  dayRecords: { id: string; dayOfWeek: number }[];
  classTypeId: string;
  instructorId: string;
  startTime: string;
  endTime: string;
  /** Dias da semana (0 = Dom … 6 = Sáb), ordenados crescentemente */
  daysOfWeek: number[];
  active: boolean;
  /** Nº de alunos distintos com matrícula ativa em qualquer registro do grupo */
  enrolledCount: number;
  classType?: ClassType;
  instructor?: Pick<User, 'id' | 'name' | 'email'>;
};

export type EnrollmentWithRefs = Enrollment & {
  student?: User;
  class?: ClassWithRefs;
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
export type InsertBeltHistory = z.infer<typeof insertBeltHistorySchema>;
export type InsertGraduationSystem = z.infer<typeof insertGraduationSystemSchema>;
export type InsertGraduationRank = z.infer<typeof insertGraduationRankSchema>;
export type InsertStudentModalityRank = z.infer<typeof insertStudentModalityRankSchema>;
export type InsertStudentRankHistory = z.infer<typeof insertStudentRankHistorySchema>;
export type InsertStudentModalityEnrollment = z.infer<typeof insertStudentModalityEnrollmentSchema>;

// ─── Responsável legal (menor de idade) ──────────────────────────────────────

export const MAJORITY_AGE = 18;

/** Parentescos sugeridos nos formulários (texto livre também é aceito pela API). */
export const GUARDIAN_RELATIONSHIPS = ['Mãe', 'Pai', 'Avó/Avô', 'Tia/Tio', 'Tutor(a) legal', 'Outro'] as const;

/** Idade completa em anos na data de referência. Usa componentes UTC — datas de nascimento são armazenadas como meia-noite UTC. */
export function calculateAge(dateOfBirth: Date, ref: Date = new Date()): number {
  let age = ref.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return age;
}

/** Data de nascimento ausente ou inválida conta como adulto — a regra só se aplica quando a idade é conhecida. */
export function isMinor(dateOfBirth: Date | string | null | undefined, ref: Date = new Date()): boolean {
  if (!dateOfBirth) return false;
  const d = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(d.getTime())) return false;
  return calculateAge(d, ref) < MAJORITY_AGE;
}

/**
 * Regra única de negócio: menor de idade exige nome e telefone do responsável legal.
 * Retorna a mensagem de erro em pt-BR, ou null quando o cadastro é válido.
 */
export function guardianRequirementError(
  data: { dateOfBirth?: Date | string | null; guardianName?: string | null; guardianPhone?: string | null },
  ref: Date = new Date(),
): string | null {
  if (!isMinor(data.dateOfBirth, ref)) return null;
  if (!data.guardianName?.trim()) return 'Aluno menor de idade: informe o nome do responsável legal';
  if (!data.guardianPhone?.trim()) return 'Aluno menor de idade: informe o telefone do responsável legal';
  return null;
}

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
  .extend({ dateOfBirth: z.string().optional() })
  .superRefine((data, ctx) => {
    if (!isMinor(data.dateOfBirth || undefined)) return;
    if (!data.guardianName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianName'],
        message: 'Nome do responsável é obrigatório para menor de idade',
      });
    }
    if (!data.guardianPhone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['guardianPhone'],
        message: 'Telefone do responsável é obrigatório para menor de idade',
      });
    }
  });

export type StudentCreateData = z.infer<typeof studentCreateSchema>;
export type StudentCreateFormData = z.infer<typeof studentCreateFormSchema>;
