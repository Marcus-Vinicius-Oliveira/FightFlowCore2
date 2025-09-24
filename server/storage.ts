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
  createClassType(classType: InsertClassType): Promise<ClassType>;
  
  // Class operations  
  getClassesByAcademy(academyId: string): Promise<Class[]>;
  createClass(classData: InsertClass): Promise<Class>;
  
  // Enrollment operations
  getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]>;
  createEnrollment(enrollment: InsertEnrollment): Promise<Enrollment>;
  
  // Attendance operations
  getAttendanceByStudent(studentId: string): Promise<Attendance[]>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  
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

  async createClassType(insertClassType: InsertClassType): Promise<ClassType> {
    const [classType] = await db
      .insert(classTypes)
      .values(insertClassType)
      .returning();
    return classType;
  }

  // Class operations
  async getClassesByAcademy(academyId: string): Promise<Class[]> {
    return await db.select()
      .from(classes)
      .where(and(eq(classes.academyId, academyId), eq(classes.active, true)));
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const [classData] = await db
      .insert(classes)
      .values(insertClass)
      .returning();
    return classData;
  }

  // Enrollment operations
  async getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
    return await db.select()
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.active, true)))
      .orderBy(desc(enrollments.startDate));
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

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const [attendanceRecord] = await db
      .insert(attendance)
      .values(insertAttendance)
      .returning();
    return attendanceRecord;
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