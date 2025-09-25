import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { 
  generateToken, 
  hashPassword, 
  comparePassword, 
  authenticateToken, 
  requireRole, 
  requireSameAcademy,
  type AuthenticatedRequest 
} from "./auth";
import { 
  insertUserSchema, 
  insertAcademySchema, 
  insertMembershipPlanSchema,
  insertClassTypeSchema,
  insertClassSchema,
  insertEnrollmentSchema,
  insertAttendanceSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ============================================================================
  // PUBLIC ROUTES (Authentication)
  // ============================================================================
  
  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is active
      if (!user.active) {
        return res.status(401).json({ error: 'Account is deactivated' });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        academyId: user.academyId,
        name: user.name
      });

      // Get academy info
      const academy = await storage.getAcademy(user.academyId);

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          firstAccess: user.firstAccess,
          academy: academy ? {
            id: academy.id,
            name: academy.name,
            slug: academy.slug
          } : null
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Signup endpoint
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const signupSchema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['ADMIN_ACADEMIA', 'PROFESSOR', 'ALUNO']),
        academyName: z.string().optional()
      });

      const validatedData = signupSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      // If admin is creating a new academy, create academy first
      let academyId: string;

      if (validatedData.academyName) {
        // Create new academy (for ADMIN_ACADEMIA) or use for ALUNO/PROFESSOR
        const academySlug = validatedData.academyName.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        // Check if academy already exists
        let existingAcademy = await storage.getAcademyBySlug(academySlug);
        
        if (existingAcademy) {
          // Only admins can create academies or add to existing ones
          if (validatedData.role === 'ADMIN_ACADEMIA') {
            return res.status(409).json({ error: 'Academy name already taken' });
          } else {
            // Non-admin users cannot select academies arbitrarily
            return res.status(400).json({ 
              error: 'Academy registration not allowed. Contact academy administrator for invitation.' 
            });
          }
        } else {
          // Create new academy (admins create, non-admins join new academy for testing)
          const newAcademy = await storage.createAcademy({
            name: validatedData.academyName,
            slug: academySlug,
            email: validatedData.email
          });
          academyId = newAcademy.id;
        }
      } else {
        // No academy name provided
        return res.status(400).json({ 
          error: 'Academy name is required' 
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create user
      const newUser = await storage.createUser({
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
        academyId
      });

      // Generate token
      const token = generateToken({
        userId: newUser.id,
        email: newUser.email,
        role: newUser.role,
        academyId: newUser.academyId,
        name: newUser.name
      });

      // Get academy info
      const academy = await storage.getAcademy(academyId);

      res.status(201).json({
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          firstAccess: newUser.firstAccess,
          academy: academy ? {
            id: academy.id,
            name: academy.name,
            slug: academy.slug
          } : null
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      console.error('Signup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Password change endpoint for first access
  app.post('/api/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const passwordSchema = z.object({
        currentPassword: z.string().min(1, 'Current password is required'),
        newPassword: z.string().min(6, 'New password must be at least 6 characters'),
        confirmPassword: z.string().min(1, 'Password confirmation is required')
      });

      const validatedData = passwordSchema.parse(req.body);

      // Check if new password matches confirmation
      if (validatedData.newPassword !== validatedData.confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      // Get current user
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isValidPassword = await comparePassword(validatedData.currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(validatedData.newPassword);

      // Update password and set firstAccess to false
      await storage.updateUser(user.id, {
        password: hashedNewPassword,
        firstAccess: false
      });

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation error', 
          details: error.errors 
        });
      }
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // PROTECTED ROUTES (Require Authentication)
  // ============================================================================

  // Get current user info
  app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const academy = await storage.getAcademy(user.academyId);

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        academy: academy ? {
          id: academy.id,
          name: academy.name,
          slug: academy.slug
        } : null
      });

    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Dashboard info endpoint - proves multitenancy security context is working
  app.get('/api/dashboard/info', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // Extract academyId from JWT payload (our tenant ID)
      const academyId = req.user!.academyId;
      
      // Get academy information
      const academy = await storage.getAcademy(academyId);
      if (!academy) {
        return res.status(404).json({ error: 'Academy not found' });
      }

      // Get statistics specific to this academy (multitenancy in action)
      const [students, instructors, classTypes] = await Promise.all([
        storage.getUsersByAcademy(academyId, 'ALUNO'),
        storage.getUsersByAcademy(academyId, 'PROFESSOR'),
        storage.getClassTypesByAcademy(academyId)
      ]);

      res.json({
        academy: {
          id: academy.id,
          name: academy.name,
          slug: academy.slug,
          email: academy.email,
          createdAt: academy.createdAt
        },
        statistics: {
          totalStudents: students.length,
          totalInstructors: instructors.length,
          totalClassTypes: classTypes.length
        },
        message: `Bem-vindo ao painel da ${academy.name}`,
        multitenancyProof: {
          requestorRole: req.user!.role,
          isolatedByAcademyId: academyId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Dashboard info error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ============================================================================
  // STUDENT MANAGEMENT (Admin and Professor access)
  // ============================================================================

  // Get students (with academy isolation)
  app.get('/api/students', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Always use academyId from authenticated user, never from request
        const students = await storage.getUsersByAcademy(req.user!.academyId, 'ALUNO');
        
        // Remove sensitive information
        const sanitizedStudents = students.map(student => ({
          id: student.id,
          name: student.name,
          email: student.email,
          phone: student.phone,
          dateOfBirth: student.dateOfBirth,
          belt: student.belt,
          active: student.active,
          createdAt: student.createdAt
        }));

        res.json(sanitizedStudents);

      } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Get instructors (with academy isolation) - Admin only
  app.get('/api/instructors', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Always use academyId from authenticated user, never from request
        const instructors = await storage.getUsersByAcademy(req.user!.academyId, 'PROFESSOR');
        
        // Remove sensitive information
        const sanitizedInstructors = instructors.map(instructor => ({
          id: instructor.id,
          name: instructor.name,
          email: instructor.email,
          phone: instructor.phone,
          active: instructor.active,
          createdAt: instructor.createdAt
        }));

        res.json(sanitizedInstructors);

      } catch (error) {
        console.error('Get instructors error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Get users with optional filtering (with academy isolation) - Admin only
  app.get('/api/users', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { email, role } = req.query;
        
        // Get all users from the academy
        const students = await storage.getUsersByAcademy(req.user!.academyId, 'ALUNO');
        const instructors = await storage.getUsersByAcademy(req.user!.academyId, 'PROFESSOR');
        const admins = await storage.getUsersByAcademy(req.user!.academyId, 'ADMIN_ACADEMIA');
        
        let allUsers = [...students, ...instructors, ...admins];
        
        // Filter by email if provided
        if (email) {
          allUsers = allUsers.filter(user => user.email === email);
        }
        
        // Filter by role if provided
        if (role) {
          allUsers = allUsers.filter(user => user.role === role);
        }
        
        // Remove sensitive information
        const sanitizedUsers = allUsers.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          belt: user.belt,
          active: user.active,
          createdAt: user.createdAt
        }));

        res.json(sanitizedUsers);

      } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Create user (student or instructor - Admin only)
  app.post('/api/students', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Schema for user creation (password is auto-generated)
        const createUserSchema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          dateOfBirth: z.string().optional(),
          belt: z.string().optional(),
          role: z.enum(['ALUNO', 'PROFESSOR']).default('ALUNO'),
        });

        const userData = createUserSchema.parse(req.body);

        // Check if email already exists
        const existingUser = await storage.getUserByEmail(userData.email);
        if (existingUser) {
          return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Generate a secure random password for the user
        const generateRandomPassword = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let password = '';
          for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return password;
        };
        
        const defaultPassword = generateRandomPassword();
        const hashedPassword = await hashPassword(defaultPassword);

        const newUser = await storage.createUser({
          ...userData,
          role: userData.role,
          academyId: req.user!.academyId,
          password: hashedPassword,
          dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth) : undefined
        });

        // Remove password from response
        const { password, ...userResponse } = newUser;
        
        res.status(201).json(userResponse);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Create student error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Update student (Admin only)
  app.patch('/api/students/:id', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const studentId = req.params.id;
        
        // Schema for student update (all fields optional)
        const updateStudentSchema = z.object({
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          dateOfBirth: z.string().optional(),
          belt: z.string().optional(),
        });

        const updateData = updateStudentSchema.parse(req.body);

        // Verify student exists and belongs to the same academy (multi-tenant security)
        const existingStudent = await storage.getUser(studentId);
        if (!existingStudent || existingStudent.academyId !== req.user!.academyId || existingStudent.role !== 'ALUNO') {
          return res.status(404).json({ error: 'Student not found or access denied' });
        }

        // If email is being updated, check if it already exists
        if (updateData.email && updateData.email !== existingStudent.email) {
          const existingUser = await storage.getUserByEmail(updateData.email);
          if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
          }
        }

        // Update student
        const updatedStudent = await storage.updateUser(studentId, {
          ...updateData,
          dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined
        });

        if (!updatedStudent) {
          return res.status(404).json({ error: 'Student not found' });
        }

        // Remove password from response
        const { password, ...studentResponse } = updatedStudent;
        
        res.json(studentResponse);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Delete student (Admin only)
  app.delete('/api/students/:id', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const studentId = req.params.id;
        
        // Verify student exists and belongs to the same academy (multi-tenant security)
        const existingStudent = await storage.getUser(studentId);
        if (!existingStudent || existingStudent.academyId !== req.user!.academyId || existingStudent.role !== 'ALUNO') {
          return res.status(404).json({ error: 'Student not found or access denied' });
        }

        // Soft delete by setting active to false
        const deletedStudent = await storage.updateUser(studentId, { active: false });

        if (!deletedStudent) {
          return res.status(404).json({ error: 'Student not found' });
        }

        res.json({ message: 'Student deleted successfully' });

      } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // ============================================================================
  // STUDENT PORTAL (Student access to own data)
  // ============================================================================

  // Get student's own data
  app.get('/api/student/me', 
    authenticateToken, 
    requireRole(['ALUNO']), 
    async (req: AuthenticatedRequest, res) => {
      try {
        const enrollments = await storage.getEnrollmentsByStudent(req.user!.id);
        const attendance = await storage.getAttendanceByStudent(req.user!.id);
        const payments = await storage.getPaymentsByStudent(req.user!.id);

        res.json({
          enrollments,
          attendance,
          payments
        });

      } catch (error) {
        console.error('Get student data error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // ============================================================================
  // CLASS MANAGEMENT (Admin access)
  // ============================================================================

  // Get class types
  app.get('/api/class-types', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classTypes = await storage.getClassTypesByAcademy(req.user!.academyId);
        res.json(classTypes);

      } catch (error) {
        console.error('Get class types error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Get classes
  app.get('/api/classes', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classes = await storage.getClassesByAcademy(req.user!.academyId);
        res.json(classes);

      } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Create class
  app.post('/api/classes',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classData = insertClassSchema.parse({
          ...req.body,
          academyId: req.user!.academyId // Always set from authenticated user
        });

        // Validate that instructorId belongs to same academy
        const instructor = await storage.getUser(classData.instructorId);
        if (!instructor || instructor.academyId !== req.user!.academyId || instructor.role !== 'PROFESSOR') {
          return res.status(400).json({ error: 'Invalid instructor or instructor does not belong to your academy' });
        }

        // Validate that classTypeId belongs to same academy
        const classType = await storage.getClassType(classData.classTypeId);
        if (!classType || classType.academyId !== req.user!.academyId) {
          return res.status(400).json({ error: 'Invalid class type or class type does not belong to your academy' });
        }

        const newClass = await storage.createClass(classData);
        res.status(201).json(newClass);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Create class type
  app.post('/api/class-types',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classTypeData = insertClassTypeSchema.parse({
          ...req.body,
          academyId: req.user!.academyId // Always set from authenticated user
        });

        const newClassType = await storage.createClassType(classTypeData);
        res.status(201).json(newClassType);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Create class type error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Update class (turma)
  app.patch('/api/classes/:id',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classId = req.params.id;
        
        // Verify class exists and belongs to the same academy
        const existingClass = await storage.getClass(classId);
        if (!existingClass || existingClass.academyId !== req.user!.academyId) {
          return res.status(404).json({ error: 'Class not found or access denied' });
        }

        const updateClassSchema = z.object({
          classTypeId: z.string().uuid().optional(),
          instructorId: z.string().uuid().optional(),
          dayOfWeek: z.number().min(0).max(6).optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          active: z.boolean().optional(),
        });

        const updateData = updateClassSchema.parse(req.body);

        // Validate that instructorId belongs to same academy (if provided)
        if (updateData.instructorId) {
          const instructor = await storage.getUser(updateData.instructorId);
          if (!instructor || instructor.academyId !== req.user!.academyId || instructor.role !== 'PROFESSOR') {
            return res.status(400).json({ error: 'Invalid instructor or instructor does not belong to your academy' });
          }
        }

        // Validate that classTypeId belongs to same academy (if provided)
        if (updateData.classTypeId) {
          const classType = await storage.getClassType(updateData.classTypeId);
          if (!classType || classType.academyId !== req.user!.academyId) {
            return res.status(400).json({ error: 'Invalid class type or class type does not belong to your academy' });
          }
        }

        const updatedClass = await storage.updateClass(classId, updateData);

        if (!updatedClass) {
          return res.status(404).json({ error: 'Class not found' });
        }

        res.json(updatedClass);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Update class error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Delete class (turma) - soft delete
  app.delete('/api/classes/:id',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classId = req.params.id;
        
        // Verify class exists and belongs to the same academy
        const existingClass = await storage.getClass(classId);
        if (!existingClass || existingClass.academyId !== req.user!.academyId) {
          return res.status(404).json({ error: 'Class not found or access denied' });
        }

        // Soft delete by setting active to false
        const deletedClass = await storage.updateClass(classId, { active: false });

        if (!deletedClass) {
          return res.status(404).json({ error: 'Class not found' });
        }

        res.json({ message: 'Class deleted successfully' });

      } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // ============================================================================
  // MÓDULO 2: PRESENÇA (Professor and Admin access)
  // ============================================================================

  // Get attendance for a specific class
  app.get('/api/classes/:classId/attendance',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classId = req.params.classId;
        const date = req.query.date as string;

        // Verify class exists and belongs to the same academy
        const existingClass = await storage.getClass(classId);
        if (!existingClass || existingClass.academyId !== req.user!.academyId) {
          return res.status(404).json({ error: 'Class not found or access denied' });
        }

        // For professors, verify they are the instructor of this class
        if (req.user!.role === 'PROFESSOR' && existingClass.instructorId !== req.user!.id) {
          return res.status(403).json({ error: 'You can only access attendance for classes you teach' });
        }

        // Get enrolled students for this class
        const enrollments = await storage.getEnrollmentsByClass(classId);
        
        // Get attendance records for the specified date
        const attendanceRecords = date 
          ? await storage.getAttendanceByClassAndDate(classId, new Date(date))
          : await storage.getAttendanceByClass(classId);

        // Combine enrollment and attendance data
        const studentsWithAttendance = enrollments.map(enrollment => {
          const attendanceRecord = attendanceRecords.find(
            record => record.studentId === enrollment.studentId && 
            (!date || record.date.toDateString() === new Date(date).toDateString())
          );

          return {
            studentId: enrollment.studentId,
            studentName: enrollment.student?.name,
            studentEmail: enrollment.student?.email,
            attendance: attendanceRecord ? {
              id: attendanceRecord.id,
              status: attendanceRecord.status,
              notes: attendanceRecord.notes,
              date: attendanceRecord.date
            } : null
          };
        });

        res.json({
          classId,
          className: existingClass.classType?.name,
          instructor: existingClass.instructor?.name,
          date,
          students: studentsWithAttendance
        });

      } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Record attendance for a student in a class
  app.post('/api/classes/:classId/attendance',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classId = req.params.classId;

        // Verify class exists and belongs to the same academy
        const existingClass = await storage.getClass(classId);
        if (!existingClass || existingClass.academyId !== req.user!.academyId) {
          return res.status(404).json({ error: 'Class not found or access denied' });
        }

        // For professors, verify they are the instructor of this class
        if (req.user!.role === 'PROFESSOR' && existingClass.instructorId !== req.user!.id) {
          return res.status(403).json({ error: 'You can only record attendance for classes you teach' });
        }

        const attendanceSchema = z.object({
          studentId: z.string().uuid(),
          date: z.string(),
          status: z.enum(['presente', 'falta', 'justificado']),
          notes: z.string().optional(),
        });

        const attendanceData = attendanceSchema.parse(req.body);

        // Verify student is enrolled in this class and belongs to same academy
        const student = await storage.getUser(attendanceData.studentId);
        if (!student || student.academyId !== req.user!.academyId || student.role !== 'ALUNO') {
          return res.status(400).json({ error: 'Student not found or does not belong to your academy' });
        }

        const enrollment = await storage.getEnrollmentByStudentAndClass(attendanceData.studentId, classId);
        if (!enrollment || !enrollment.active) {
          return res.status(400).json({ error: 'Student is not enrolled in this class or enrollment is inactive' });
        }

        // Check if attendance already exists for this student, class, and date
        const existingAttendance = await storage.getAttendanceByStudentClassAndDate(
          attendanceData.studentId, 
          classId, 
          new Date(attendanceData.date)
        );

        let attendanceRecord;
        if (existingAttendance) {
          // Update existing attendance
          attendanceRecord = await storage.updateAttendance(existingAttendance.id, {
            status: attendanceData.status,
            notes: attendanceData.notes,
          });
        } else {
          // Create new attendance record
          attendanceRecord = await storage.createAttendance({
            studentId: attendanceData.studentId,
            classId,
            academyId: req.user!.academyId,
            date: new Date(attendanceData.date),
            status: attendanceData.status,
            notes: attendanceData.notes,
            present: attendanceData.status === 'presente' // legacy field for compatibility
          });
        }

        res.status(201).json(attendanceRecord);

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ 
            error: 'Validation error', 
            details: error.errors 
          });
        }
        console.error('Record attendance error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // Get weekly schedule (grade semanal)
  app.get('/api/classes/schedule/weekly',
    authenticateToken,
    requireRole(['ADMIN_ACADEMIA', 'PROFESSOR']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const classes = await storage.getClassesByAcademy(req.user!.academyId);
        
        // For professors, filter to only classes they teach
        const filteredClasses = req.user!.role === 'PROFESSOR' 
          ? classes.filter(cls => cls.instructorId === req.user!.id)
          : classes;

        // Group classes by day of week
        const weeklySchedule: Record<string, any[]> = {
          "0": [], // Sunday
          "1": [], // Monday
          "2": [], // Tuesday
          "3": [], // Wednesday
          "4": [], // Thursday
          "5": [], // Friday
          "6": []  // Saturday
        };

        filteredClasses.forEach(cls => {
          const dayOfWeek = cls.dayOfWeek.toString();
          weeklySchedule[dayOfWeek].push({
            id: cls.id,
            classType: cls.classType?.name,
            instructor: cls.instructor?.name,
            startTime: cls.startTime,
            endTime: cls.endTime,
            active: cls.active
          });
        });

        // Sort classes within each day by start time
        Object.keys(weeklySchedule).forEach(day => {
          weeklySchedule[day].sort((a, b) => 
            a.startTime.localeCompare(b.startTime)
          );
        });

        res.json(weeklySchedule);

      } catch (error) {
        console.error('Get weekly schedule error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  // ============================================================================
  // MEMBERSHIP PLANS (Admin access)
  // ============================================================================

  // Get membership plans
  app.get('/api/membership-plans', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        const plans = await storage.getMembershipPlansByAcademy(req.user!.academyId);
        res.json(plans);

      } catch (error) {
        console.error('Get membership plans error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  );

  const httpServer = createServer(app);
  return httpServer;
}