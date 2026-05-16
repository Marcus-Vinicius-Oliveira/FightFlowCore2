import {
  users,
  academies,
  membershipPlans,
  classTypes,
  classes,
  enrollments,
  attendance,
  payments,
  planos,
  assinaturas,
  beltHistory,
  userRoleEnum,
  type User,
  type Academy,
  type MembershipPlan,
  type ClassType,
  type Class,
  type Enrollment,
  type Attendance,
  type Payment,
  type Plano,
  type Assinatura,
  type BeltHistory,
  type ClassWithRefs,
  type EnrollmentWithRefs,
  type InsertUser,
  type InsertAcademy,
  type InsertMembershipPlan,
  type InsertClassType,
  type InsertClass,
  type InsertEnrollment,
  type InsertAttendance,
  type InsertPayment,
  type InsertPlano,
  type InsertAssinatura,
  type InsertBeltHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, inArray, gte, lt, count } from "drizzle-orm";

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getClassesByInstructor(instructorId: string): Promise<Class[]>;

  // Academy operations
  getAcademy(id: string): Promise<Academy | undefined>;
  getAcademyBySlug(slug: string): Promise<Academy | undefined>;
  createAcademy(academy: InsertAcademy): Promise<Academy>;
  updateAcademy(id: string, updates: Partial<InsertAcademy>): Promise<Academy | undefined>;

  // User academy operations (with tenant isolation + pagination)
  getUsersByAcademy(academyId: string, role?: string, pagination?: PaginationParams): Promise<User[]>;
  getUsersByAcademyAndRoles(academyId: string, roles: string[]): Promise<User[]>;
  countUsersByAcademy(academyId: string, role?: string): Promise<number>;
  createStudentWithPlanEnforcement(insertUser: InsertUser): Promise<{ user: User } | { limitError: string }>;

  // Membership plan operations
  getMembershipPlansByAcademy(academyId: string): Promise<MembershipPlan[]>;
  getMembershipPlan(id: string): Promise<MembershipPlan | undefined>;
  createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;
  updateMembershipPlan(id: string, updates: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined>;

  // Class type operations
  getClassTypesByAcademy(academyId: string): Promise<ClassType[]>;
  getClassType(id: string): Promise<ClassType | undefined>;
  createClassType(classType: InsertClassType): Promise<ClassType>;
  updateClassType(id: string, updates: Partial<InsertClassType>): Promise<ClassType | undefined>;

  // Class operations
  getClassesByAcademy(academyId: string): Promise<ClassWithRefs[]>;
  getClass(id: string): Promise<ClassWithRefs | undefined>;
  createClass(classData: InsertClass): Promise<Class>;
  updateClass(id: string, updates: Partial<InsertClass>): Promise<Class | undefined>;

  // Enrollment operations
  getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]>;
  getEnrollmentsByClass(classId: string): Promise<EnrollmentWithRefs[]>;
  getEnrollmentByStudentAndClass(studentId: string, classId: string): Promise<Enrollment | undefined>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;

  // Attendance operations
  getAttendanceByStudent(studentId: string): Promise<Attendance[]>;
  getAttendanceByClass(classId: string): Promise<Attendance[]>;
  getAttendanceByClassAndDate(classId: string, date: Date): Promise<Attendance[]>;
  getAttendanceByStudentClassAndDate(studentId: string, classId: string, date: Date): Promise<Attendance | undefined>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined>;

  // Payment operations
  getPaymentsByStudent(studentId: string): Promise<Payment[]>;
  getPaymentsByAcademy(academyId: string, pagination?: PaginationParams): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined>;

  // User lookup helpers
  getUserByEmailAndAcademy(email: string, academyId: string): Promise<User | undefined>;
  createAcademyWithAdmin(
    academyData: InsertAcademy,
    userData: Omit<InsertUser, 'academyId'>,
    freePlanoId?: string,
  ): Promise<{ academy: Academy; user: User; assinatura?: Assinatura }>;

  // Belt history operations
  getBeltHistory(studentId: string): Promise<BeltHistory[]>;
  createBeltHistoryEntry(data: InsertBeltHistory): Promise<BeltHistory>;

  // Super Admin operations
  getAllAcademies(): Promise<Academy[]>;
  getAllPlanos(): Promise<Plano[]>;
  getPlano(id: string): Promise<Plano | undefined>;
  createPlano(plano: InsertPlano): Promise<Plano>;
  updatePlano(id: string, updates: Partial<InsertPlano>): Promise<Plano | undefined>;
  getAllAssinaturas(): Promise<Assinatura[]>;
  getAssinaturasByAcademia(academiaId: string): Promise<Assinatura[]>;
  createAssinatura(assinatura: InsertAssinatura): Promise<Assinatura>;
  updateAssinatura(id: string, updates: Partial<InsertAssinatura>): Promise<Assinatura | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getClassesByInstructor(instructorId: string): Promise<Class[]> {
    return db.select().from(classes).where(
      and(eq(classes.instructorId, instructorId), eq(classes.active, true))
    );
  }

  async getAcademy(id: string): Promise<Academy | undefined> {
    const [academy] = await db.select().from(academies).where(eq(academies.id, id));
    return academy;
  }

  async getAcademyBySlug(slug: string): Promise<Academy | undefined> {
    const [academy] = await db.select().from(academies).where(eq(academies.slug, slug));
    return academy;
  }

  async createAcademy(insertAcademy: InsertAcademy): Promise<Academy> {
    const [academy] = await db.insert(academies).values(insertAcademy).returning();
    return academy;
  }

  async updateAcademy(id: string, updates: Partial<InsertAcademy>): Promise<Academy | undefined> {
    const [academy] = await db.update(academies).set(updates).where(eq(academies.id, id)).returning();
    return academy;
  }

  async getUsersByAcademy(academyId: string, role?: string, pagination?: PaginationParams): Promise<User[]> {
    const validRoles = userRoleEnum.enumValues;
    const conditions = role && validRoles.includes(role as typeof validRoles[number])
      ? and(eq(users.academyId, academyId), eq(users.role, role as typeof validRoles[number]))
      : eq(users.academyId, academyId);

    const query = db.select().from(users).where(conditions);

    if (pagination?.limit !== undefined) {
      return query.limit(pagination.limit).offset(pagination.offset ?? 0);
    }

    return query;
  }

  // Single query for multiple roles — avoids N separate round trips.
  async getUsersByAcademyAndRoles(academyId: string, roles: string[]): Promise<User[]> {
    const validRoles = userRoleEnum.enumValues;
    const filteredRoles = roles.filter(r => validRoles.includes(r as typeof validRoles[number])) as typeof validRoles[number][];
    return db
      .select()
      .from(users)
      .where(and(eq(users.academyId, academyId), inArray(users.role, filteredRoles)));
  }

  async countUsersByAcademy(academyId: string, role?: string): Promise<number> {
    const validRoles = userRoleEnum.enumValues;
    const conditions = role && validRoles.includes(role as typeof validRoles[number])
      ? and(eq(users.academyId, academyId), eq(users.role, role as typeof validRoles[number]))
      : eq(users.academyId, academyId);

    const [result] = await db.select({ total: count() }).from(users).where(conditions);
    return result.total;
  }

  async createStudentWithPlanEnforcement(
    insertUser: InsertUser,
  ): Promise<{ user: User } | { limitError: string }> {
    // Non-student roles bypass plan enforcement
    if (insertUser.role !== 'ALUNO') {
      const user = await this.createUser(insertUser);
      return { user };
    }

    return db.transaction(async (tx) => {
      const academyId = insertUser.academyId!;

      // Lock the active subscription row so concurrent requests queue here
      // instead of racing through the count check.
      const [activeAssinatura] = await tx
        .select()
        .from(assinaturas)
        .where(and(eq(assinaturas.academiaId, academyId), eq(assinaturas.status, 'ativa')))
        .for('update');

      if (activeAssinatura) {
        const [plano] = await tx.select().from(planos).where(eq(planos.id, activeAssinatura.planoId));
        if (plano) {
          const [{ total: currentCount }] = await tx
            .select({ total: count() })
            .from(users)
            .where(and(eq(users.academyId, academyId), eq(users.role, 'ALUNO')));

          if (currentCount >= plano.limiteAlunos) {
            return {
              limitError: `Limite de alunos atingido para o plano "${plano.nome}" (${plano.limiteAlunos} alunos). Faça upgrade do seu plano.`,
            };
          }
        }
      }

      const [user] = await tx.insert(users).values(insertUser).returning();
      return { user };
    });
  }

  async getMembershipPlansByAcademy(academyId: string): Promise<MembershipPlan[]> {
    return db
      .select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.academyId, academyId), eq(membershipPlans.active, true)));
  }

  async getMembershipPlan(id: string): Promise<MembershipPlan | undefined> {
    const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.id, id));
    return plan;
  }

  async createMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db.insert(membershipPlans).values(insertPlan).returning();
    return plan;
  }

  async updateMembershipPlan(id: string, updates: Partial<InsertMembershipPlan>): Promise<MembershipPlan | undefined> {
    const [plan] = await db.update(membershipPlans).set(updates).where(eq(membershipPlans.id, id)).returning();
    return plan;
  }

  async getClassTypesByAcademy(academyId: string): Promise<ClassType[]> {
    return db
      .select()
      .from(classTypes)
      .where(and(eq(classTypes.academyId, academyId), eq(classTypes.active, true)));
  }

  async getClassType(id: string): Promise<ClassType | undefined> {
    const [ct] = await db.select().from(classTypes).where(eq(classTypes.id, id));
    return ct;
  }

  async createClassType(insertClassType: InsertClassType): Promise<ClassType> {
    const [ct] = await db.insert(classTypes).values(insertClassType).returning();
    return ct;
  }

  async updateClassType(id: string, updates: Partial<InsertClassType>): Promise<ClassType | undefined> {
    const [ct] = await db.update(classTypes).set(updates).where(eq(classTypes.id, id)).returning();
    return ct;
  }

  async getClassesByAcademy(academyId: string): Promise<ClassWithRefs[]> {
    return db.query.classes.findMany({
      where: and(eq(classes.academyId, academyId), eq(classes.active, true)),
      with: { classType: true, instructor: true },
    }) as Promise<ClassWithRefs[]>;
  }

  async getClass(id: string): Promise<ClassWithRefs | undefined> {
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, id),
      with: { classType: true, instructor: true },
    });
    return classData as ClassWithRefs | undefined;
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const [classData] = await db.insert(classes).values(insertClass).returning();
    return classData;
  }

  async updateClass(id: string, updates: Partial<InsertClass>): Promise<Class | undefined> {
    const [classData] = await db.update(classes).set(updates).where(eq(classes.id, id)).returning();
    return classData;
  }

  async getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
    return db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.active, true)))
      .orderBy(desc(enrollments.startDate));
  }

  async getEnrollmentsByClass(classId: string): Promise<EnrollmentWithRefs[]> {
    return db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, classId), eq(enrollments.active, true)),
      with: { student: true },
      orderBy: desc(enrollments.startDate),
    }) as Promise<EnrollmentWithRefs[]>;
  }

  async getEnrollmentByStudentAndClass(studentId: string, classId: string): Promise<Enrollment | undefined> {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId), eq(enrollments.active, true)));
    return enrollment;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const [enrollment] = await db.insert(enrollments).values(insertEnrollment).returning();
    return enrollment;
  }

  async getAttendanceByStudent(studentId: string): Promise<Attendance[]> {
    return db.select().from(attendance).where(eq(attendance.studentId, studentId)).orderBy(desc(attendance.date));
  }

  async getAttendanceByClass(classId: string): Promise<Attendance[]> {
    return db.select().from(attendance).where(eq(attendance.classId, classId)).orderBy(desc(attendance.date));
  }

  async getAttendanceByClassAndDate(classId: string, date: Date): Promise<Attendance[]> {
    // Use a date range to match any time within the given day, not exact timestamp equality.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return db
      .select()
      .from(attendance)
      .where(and(eq(attendance.classId, classId), gte(attendance.date, startOfDay), lt(attendance.date, endOfDay)))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByStudentClassAndDate(studentId: string, classId: string, date: Date): Promise<Attendance | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [record] = await db
      .select()
      .from(attendance)
      .where(and(
        eq(attendance.studentId, studentId),
        eq(attendance.classId, classId),
        gte(attendance.date, startOfDay),
        lt(attendance.date, endOfDay),
      ));
    return record;
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const [record] = await db.insert(attendance).values(insertAttendance).returning();
    return record;
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const [record] = await db.update(attendance).set(updates).where(eq(attendance.id, id)).returning();
    return record;
  }

  async getPaymentsByStudent(studentId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.studentId, studentId)).orderBy(desc(payments.dueDate));
  }

  async getPaymentsByAcademy(academyId: string, pagination?: PaginationParams): Promise<Payment[]> {
    const query = db.select().from(payments).where(eq(payments.academyId, academyId)).orderBy(desc(payments.dueDate));
    if (pagination?.limit !== undefined) {
      return query.limit(pagination.limit).offset(pagination.offset ?? 0);
    }
    return query;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: string, updates: Partial<InsertPayment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(updates).where(eq(payments.id, id)).returning();
    return payment;
  }

  async getUserByEmailAndAcademy(email: string, academyId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.academyId, academyId)));
    return user;
  }

  async createAcademyWithAdmin(
    academyData: InsertAcademy,
    userData: Omit<InsertUser, 'academyId'>,
    freePlanoId?: string,
  ): Promise<{ academy: Academy; user: User; assinatura?: Assinatura }> {
    return db.transaction(async (tx) => {
      const [academy] = await tx.insert(academies).values(academyData).returning();
      const [user] = await tx.insert(users).values({ ...userData, academyId: academy.id }).returning();

      let assinatura: Assinatura | undefined;
      if (freePlanoId) {
        [assinatura] = await tx
          .insert(assinaturas)
          .values({ academiaId: academy.id, planoId: freePlanoId, dataInicio: new Date(), status: 'teste' })
          .returning();
      }

      return { academy, user, assinatura };
    });
  }

  async getAllAcademies(): Promise<Academy[]> {
    return db.select().from(academies).orderBy(desc(academies.createdAt));
  }

  async getAllPlanos(): Promise<Plano[]> {
    return db.select().from(planos).orderBy(desc(planos.createdAt));
  }

  async getPlano(id: string): Promise<Plano | undefined> {
    const [plano] = await db.select().from(planos).where(eq(planos.id, id));
    return plano;
  }

  async createPlano(insertPlano: InsertPlano): Promise<Plano> {
    const [plano] = await db.insert(planos).values(insertPlano).returning();
    return plano;
  }

  async updatePlano(id: string, updates: Partial<InsertPlano>): Promise<Plano | undefined> {
    const [plano] = await db.update(planos).set(updates).where(eq(planos.id, id)).returning();
    return plano;
  }

  async getAllAssinaturas(): Promise<Assinatura[]> {
    return db.select().from(assinaturas).orderBy(desc(assinaturas.createdAt));
  }

  async getAssinaturasByAcademia(academiaId: string): Promise<Assinatura[]> {
    return db.select().from(assinaturas).where(eq(assinaturas.academiaId, academiaId)).orderBy(desc(assinaturas.createdAt));
  }

  async createAssinatura(insertAssinatura: InsertAssinatura): Promise<Assinatura> {
    const [assinatura] = await db.insert(assinaturas).values(insertAssinatura).returning();
    return assinatura;
  }

  async updateAssinatura(id: string, updates: Partial<InsertAssinatura>): Promise<Assinatura | undefined> {
    const [assinatura] = await db.update(assinaturas).set(updates).where(eq(assinaturas.id, id)).returning();
    return assinatura;
  }

  async getBeltHistory(studentId: string): Promise<BeltHistory[]> {
    return db.select().from(beltHistory)
      .where(eq(beltHistory.studentId, studentId))
      .orderBy(desc(beltHistory.promotedAt));
  }

  async createBeltHistoryEntry(data: InsertBeltHistory): Promise<BeltHistory> {
    const [entry] = await db.insert(beltHistory).values(data).returning();
    return entry;
  }
}

export const storage = new DatabaseStorage();
