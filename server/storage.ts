import { 
  users, 
  academies, 
  membershipPlans, 
  classTypes, 
  classes, 
  enrollments, 
  attendance, 
  payments,
  type User, 
  type Academy,
  type MembershipPlan,
  type ClassType,
  type Class,
  type Enrollment,
  type Attendance,
  type Payment,
  type ClassWithRefs,
  type EnrollmentWithRefs,
  type InsertUser, 
  type InsertAcademy,
  type InsertMembershipPlan,
  type InsertClassType,
  type InsertClass,
  type InsertEnrollment,
  type InsertAttendance,
  type InsertPayment
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Academy operations
  getAcademy(id: string): Promise<Academy | undefined>;
  getAcademyBySlug(slug: string): Promise<Academy | undefined>;
  createAcademy(academy: InsertAcademy): Promise<Academy>;
  updateAcademy(id: string, updates: Partial<InsertAcademy>): Promise<Academy | undefined>;
  
  // User academy operations (with tenant isolation)
  getUsersByAcademy(academyId: string, role?: string): Promise<User[]>;
  
  // Membership plan operations
  getMembershipPlansByAcademy(academyId: string): Promise<MembershipPlan[]>;
  createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>;
  
  // Class type operations
  getClassTypesByAcademy(academyId: string): Promise<ClassType[]>;
  getClassType(id: string): Promise<ClassType | undefined>;
  createClassType(classType: InsertClassType): Promise<ClassType>;
  
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
  createPayment(payment: InsertPayment): Promise<Payment>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // Academy operations
  async getAcademy(id: string): Promise<Academy | undefined> {
    const [academy] = await db.select().from(academies).where(eq(academies.id, id));
    return academy || undefined;
  }

  async getAcademyBySlug(slug: string): Promise<Academy | undefined> {
    const [academy] = await db.select().from(academies).where(eq(academies.slug, slug));
    return academy || undefined;
  }

  async createAcademy(insertAcademy: InsertAcademy): Promise<Academy> {
    const [academy] = await db
      .insert(academies)
      .values(insertAcademy)
      .returning();
    return academy;
  }

  async updateAcademy(id: string, updates: Partial<InsertAcademy>): Promise<Academy | undefined> {
    const [academy] = await db
      .update(academies)
      .set(updates)
      .where(eq(academies.id, id))
      .returning();
    return academy || undefined;
  }

  // User academy operations (with tenant isolation)
  async getUsersByAcademy(academyId: string, role?: string): Promise<User[]> {
    if (role) {
      return await db.select().from(users).where(and(eq(users.academyId, academyId), eq(users.role, role as any)));
    }
    
    return await db.select().from(users).where(eq(users.academyId, academyId));
  }

  // Membership plan operations
  async getMembershipPlansByAcademy(academyId: string): Promise<MembershipPlan[]> {
    return await db.select()
      .from(membershipPlans)
      .where(and(eq(membershipPlans.academyId, academyId), eq(membershipPlans.active, true)));
  }

  async createMembershipPlan(insertPlan: InsertMembershipPlan): Promise<MembershipPlan> {
    const [plan] = await db
      .insert(membershipPlans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  // Class type operations
  async getClassTypesByAcademy(academyId: string): Promise<ClassType[]> {
    return await db.select()
      .from(classTypes)
      .where(and(eq(classTypes.academyId, academyId), eq(classTypes.active, true)));
  }

  async getClassType(id: string): Promise<ClassType | undefined> {
    const [classType] = await db.select().from(classTypes).where(eq(classTypes.id, id));
    return classType || undefined;
  }

  async createClassType(insertClassType: InsertClassType): Promise<ClassType> {
    const [classType] = await db
      .insert(classTypes)
      .values(insertClassType)
      .returning();
    return classType;
  }

  // Class operations
  async getClassesByAcademy(academyId: string): Promise<ClassWithRefs[]> {
    return await db.query.classes.findMany({
      where: and(eq(classes.academyId, academyId), eq(classes.active, true)),
      with: {
        classType: true,
        instructor: true
      }
    }) as ClassWithRefs[];
  }

  async getClass(id: string): Promise<ClassWithRefs | undefined> {
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, id),
      with: {
        classType: true,
        instructor: true
      }
    });
    return classData as ClassWithRefs || undefined;
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const [classData] = await db
      .insert(classes)
      .values(insertClass)
      .returning();
    return classData;
  }

  async updateClass(id: string, updates: Partial<InsertClass>): Promise<Class | undefined> {
    const [classData] = await db
      .update(classes)
      .set(updates)
      .where(eq(classes.id, id))
      .returning();
    return classData || undefined;
  }

  // Enrollment operations
  async getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
    return await db.select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.active, true)))
      .orderBy(desc(enrollments.startDate));
  }

  async getEnrollmentsByClass(classId: string): Promise<EnrollmentWithRefs[]> {
    return await db.query.enrollments.findMany({
      where: and(eq(enrollments.classId, classId), eq(enrollments.active, true)),
      with: {
        student: true
      },
      orderBy: desc(enrollments.startDate)
    }) as EnrollmentWithRefs[];
  }

  async getEnrollmentByStudentAndClass(studentId: string, classId: string): Promise<Enrollment | undefined> {
    const [enrollment] = await db.select()
      .from(enrollments)
      .where(and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.classId, classId),
        eq(enrollments.active, true)
      ));
    return enrollment || undefined;
  }

  async createEnrollment(insertEnrollment: InsertEnrollment): Promise<Enrollment> {
    const [enrollment] = await db
      .insert(enrollments)
      .values(insertEnrollment)
      .returning();
    return enrollment;
  }

  // Attendance operations
  async getAttendanceByStudent(studentId: string): Promise<Attendance[]> {
    return await db.select()
      .from(attendance)
      .where(eq(attendance.studentId, studentId))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByClass(classId: string): Promise<Attendance[]> {
    return await db.select()
      .from(attendance)
      .where(eq(attendance.classId, classId))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByClassAndDate(classId: string, date: Date): Promise<Attendance[]> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    return await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.classId, classId),
        eq(attendance.date, date)
      ))
      .orderBy(desc(attendance.date));
  }

  async getAttendanceByStudentClassAndDate(studentId: string, classId: string, date: Date): Promise<Attendance | undefined> {
    const [attendanceRecord] = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.studentId, studentId),
        eq(attendance.classId, classId),
        eq(attendance.date, date)
      ));
    return attendanceRecord || undefined;
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const [attendanceRecord] = await db
      .insert(attendance)
      .values(insertAttendance)
      .returning();
    return attendanceRecord;
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const [attendanceRecord] = await db
      .update(attendance)
      .set(updates)
      .where(eq(attendance.id, id))
      .returning();
    return attendanceRecord || undefined;
  }

  // Payment operations
  async getPaymentsByStudent(studentId: string): Promise<Payment[]> {
    return await db.select()
      .from(payments)
      .where(eq(payments.studentId, studentId))
      .orderBy(desc(payments.dueDate));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db
      .insert(payments)
      .values(insertPayment)
      .returning();
    return payment;
  }
}

export const storage = new DatabaseStorage();