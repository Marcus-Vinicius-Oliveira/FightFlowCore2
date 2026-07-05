import { queryClient, INVALID_TOKEN_ERROR } from "./queryClient";

const API_BASE = ''; // Since frontend and backend are on same port

interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO';
  academyName?: string;
}

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    firstAccess?: boolean;
    academy: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  belt?: string;
  dateOfBirth?: string;
  active?: boolean;
  firstAccess?: boolean;
  createdAt?: string;
  academy?: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface Student extends User {
  role: 'ALUNO';
}

export interface ClassType {
  id: string;
  academyId: string;
  name: string;
  description: string | null;
  duration: number;
  maxCapacity: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  academyId: string;
  classTypeId: string;
  instructorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  classType?: ClassType;
  instructor?: { id: string; name: string; email: string };
}

export interface MembershipPlan {
  id: string;
  academyId: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  classesPerWeek: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  academyId: string;
  membershipPlanId: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: 'pending' | 'paid' | 'overdue';
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

class ApiClient {
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}/api${endpoint}`;
    
    const config: RequestInit = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      // Handle 401 unauthorized - clear tokens and redirect to auth
      if (response.status === 401) {
        this.logout();
        
        // Dispatch custom event to notify the app of automatic logout
        const event = new CustomEvent('auth:unauthorized', {
          detail: { message: 'Session expired. Please log in again.' }
        });
        window.dispatchEvent(event);
        
        throw new Error('Session expired. Please log in again.');
      }

      const error = await response.json().catch(() => ({
        error: `HTTP ${response.status} - ${response.statusText}`
      }));

      // Token expirado responde 403 (não 401) — mesma regra do queryClient:
      // só o 403 do middleware de auth desloga; 403 de permissão passa adiante.
      if (response.status === 403 && error.error === INVALID_TOKEN_ERROR) {
        this.logout();
        window.dispatchEvent(new CustomEvent('auth:unauthorized', {
          detail: { message: 'Sessão expirada. Faça login novamente.' }
        }));
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Authentication — bypass the 401 handler so credential errors don't trigger "session expired"
  private async authFetch<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE}/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erro ${response.status}`);
    }
    return response.json();
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.authFetch<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  }

  async signup(userData: SignupRequest): Promise<AuthResponse> {
    const response = await this.authFetch<AuthResponse>('/auth/signup', userData);
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout(): void {
    const token = this.getAuthToken();
    // Clear client state first to prevent re-entrant loops on 401
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    queryClient.clear();
    // Best-effort server-side token revocation (fire-and-forget)
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }).catch(() => { /* ignore network errors — client state already cleared */ });
    }
  }

  async changePassword(passwordData: ChangePasswordRequest): Promise<{ message: string }> {
    const response = await this.request<{ message: string; token?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
    // Server rotates the token on password change — update localStorage so the
    // next request uses the fresh token instead of the revoked one.
    if (response.token) {
      localStorage.setItem('auth_token', response.token);
    }
    return response;
  }

  // Students
  async getStudents(): Promise<Student[]> {
    return this.request<Student[]>('/students');
  }

  async createStudent(studentData: Omit<SignupRequest, 'role'>): Promise<Student> {
    return this.request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify({ ...studentData, role: 'ALUNO' }),
    });
  }

  // Student Portal
  async getStudentData(): Promise<{
    enrollments: any[];
    attendance: any[];
    payments: any[];
  }> {
    return this.request('/student/me');
  }

  // Classes
  async getClasses(): Promise<Class[]> {
    return this.request<Class[]>('/classes');
  }

  async getClassTypes(): Promise<ClassType[]> {
    return this.request<ClassType[]>('/class-types');
  }

  async createClass(classData: {
    classTypeId: string;
    instructorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }): Promise<any> {
    return this.request('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async createClassType(classTypeData: {
    name: string;
    description?: string;
    duration: number;
    maxCapacity?: number;
  }): Promise<any> {
    return this.request('/class-types', {
      method: 'POST',
      body: JSON.stringify(classTypeData),
    });
  }

  // Membership Plans
  async getMembershipPlans(): Promise<MembershipPlan[]> {
    return this.request<MembershipPlan[]>('/membership-plans');
  }

  async createMembershipPlan(data: {
    name: string;
    description?: string;
    price: number;
    duration: number;
    classesPerWeek?: number;
  }): Promise<MembershipPlan> {
    return this.request<MembershipPlan>('/membership-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payments
  async getPayments(params?: { studentId?: string; limit?: number; offset?: number }): Promise<Payment[]> {
    const query = new URLSearchParams();
    if (params?.studentId) query.set('studentId', params.studentId);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString();
    return this.request<Payment[]>(`/payments${qs ? `?${qs}` : ''}`);
  }

  async createPayment(data: {
    studentId: string;
    membershipPlanId: string;
    amount: number;
    dueDate: string;
    paidDate?: string;
    status?: 'pending' | 'paid' | 'overdue';
    notes?: string;
  }): Promise<Payment> {
    return this.request<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, data: {
    status?: 'pending' | 'paid' | 'overdue';
    paidDate?: string;
    paymentMethod?: string;
    notes?: string;
    amount?: number;
  }): Promise<Payment> {
    return this.request<Payment>(`/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Utility methods
  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    const user = localStorage.getItem('user');
    return !!(token && user);
  }

  getCurrentUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export const apiClient = new ApiClient();