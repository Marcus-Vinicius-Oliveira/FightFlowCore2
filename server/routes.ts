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

      if (validatedData.role === 'ADMIN_ACADEMIA' && validatedData.academyName) {
        // Create new academy
        const academySlug = validatedData.academyName.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        // Check if slug already exists
        const existingAcademy = await storage.getAcademyBySlug(academySlug);
        if (existingAcademy) {
          return res.status(409).json({ error: 'Academy name already taken' });
        }

        const newAcademy = await storage.createAcademy({
          name: validatedData.academyName,
          slug: academySlug,
          email: validatedData.email
        });

        academyId = newAcademy.id;
      } else {
        // For non-admin users, they need to provide academy info separately
        // For demo purposes, we'll create a default academy
        return res.status(400).json({ 
          error: 'Academy information required for this role' 
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

  // Create student (Admin only)
  app.post('/api/students', 
    authenticateToken, 
    requireRole(['ADMIN_ACADEMIA']),
    requireSameAcademy,
    async (req: AuthenticatedRequest, res) => {
      try {
        // Schema for student creation (password is auto-generated)
        const createStudentSchema = z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
          dateOfBirth: z.string().optional(),
          belt: z.string().optional(),
        });

        const studentData = createStudentSchema.parse(req.body);

        // Check if email already exists
        const existingUser = await storage.getUserByEmail(studentData.email);
        if (existingUser) {
          return res.status(409).json({ error: 'User with this email already exists' });
        }

        // Generate a default password (first name + 123)
        const defaultPassword = studentData.name.split(' ')[0].toLowerCase() + '123';
        const hashedPassword = await hashPassword(defaultPassword);

        const newStudent = await storage.createUser({
          ...studentData,
          role: 'ALUNO',
          academyId: req.user!.academyId,
          password: hashedPassword,
          dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : undefined
        });

        // Remove password from response
        const { password, ...studentResponse } = newStudent;
        
        res.status(201).json(studentResponse);

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

        // Verify student exists and belongs to the same academy
        const existingStudent = await storage.getUser(studentId);
        if (!existingStudent || existingStudent.academyId !== req.user!.academyId || existingStudent.role !== 'ALUNO') {
          return res.status(404).json({ error: 'Student not found' });
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