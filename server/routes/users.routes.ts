import { Router } from "express";
import { storage } from "../storage";
import {
  authenticateToken,
  requireRole,
  requireSameAcademy,
  type AuthenticatedRequest,
} from "../auth";

const router = Router();

// GET /api/users — search users within the academy (single optimized query)
router.get('/',
  authenticateToken,
  requireRole(['ADMIN_ACADEMIA']),
  requireSameAcademy,
  async (req: AuthenticatedRequest, res) => {
    try {
      const academyId = req.user!.academyId;
      if (!academyId) return res.status(403).json({ error: 'Academy ID obrigatório' });

      const { email, role } = req.query;

      // Single query for all roles instead of 3 separate round trips
      let allUsers = await storage.getUsersByAcademyAndRoles(academyId, ['ALUNO', 'PROFESSOR', 'ADMIN_ACADEMIA']);

      if (email) allUsers = allUsers.filter(u => u.email === email);
      if (role) allUsers = allUsers.filter(u => u.role === role);

      const sanitized = allUsers.map(u => ({
        id: u.id, name: u.name, email: u.email,
        role: u.role, phone: u.phone,
        dateOfBirth: u.dateOfBirth, belt: u.belt,
        active: u.active, createdAt: u.createdAt,
      }));

      res.json(sanitized);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/student/me — student portal: own data
router.get('/student/me',
  authenticateToken,
  requireRole(['ALUNO']),
  async (req: AuthenticatedRequest, res) => {
    try {
      const [enrollmentsList, attendanceList, paymentsList] = await Promise.all([
        storage.getEnrollmentsByStudent(req.user!.id),
        storage.getAttendanceByStudent(req.user!.id),
        storage.getPaymentsByStudent(req.user!.id),
      ]);
      res.json({ enrollments: enrollmentsList, attendance: attendanceList, payments: paymentsList });
    } catch (error) {
      console.error('Get student data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
