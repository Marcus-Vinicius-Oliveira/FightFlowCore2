import { Router } from "express";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

// GET /api/users — search users within the academy
router.get('/users',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const { email, role } = req.query;

      let allUsers;
      if (typeof email === 'string' && email) {
        // Single user lookup by email — DB-level exact match
        const found = await storage.getUserByEmailAndAcademy(email, academyId);
        allUsers = found ? [found] : [];
        if (typeof role === 'string' && role) {
          allUsers = allUsers.filter(u => u.role === role);
        }
      } else if (typeof role === 'string' && role) {
        // DB-level role filter
        allUsers = await storage.getUsersByAcademy(academyId, role);
      } else {
        allUsers = await storage.getUsersByAcademyAndRoles(academyId, ['ALUNO', 'PROFESSOR', 'ADMIN_ACADEMIA']);
      }

      const sanitized = allUsers.map(u => ({
        id: u.id, name: u.name, email: u.email,
        role: u.role, phone: u.phone,
        dateOfBirth: u.dateOfBirth, belt: u.belt,
        active: u.active, createdAt: u.createdAt,
      }));

      res.json(sanitized);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/student/me/belt-history — student portal: own graduation history
router.get('/student/me/belt-history',
  authenticateToken,
  requireRole(['ALUNO']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const history = await storage.getBeltHistory(req.user!.id);
      res.json(history);
    } catch (error) {
      console.error('Get student belt history error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

// GET /api/student/me — student portal: own data
router.get('/student/me',
  authenticateToken,
  requireRole(['ALUNO']),
  async (req: AuthenticatedRequest, res) => {
    try {
      // Com a relação class (classType + instructor): o portal do aluno
      // renderiza horários a partir de enrollment.class.*
      const [enrollmentsList, attendanceList, paymentsList] = await Promise.all([
        storage.getEnrollmentsByStudentWithClass(req.user!.id),
        storage.getAttendanceByStudent(req.user!.id),
        storage.getPaymentsByStudent(req.user!.id),
      ]);
      res.json({ enrollments: enrollmentsList, attendance: attendanceList, payments: paymentsList });
    } catch (error) {
      console.error('Get student data error:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export default router;
