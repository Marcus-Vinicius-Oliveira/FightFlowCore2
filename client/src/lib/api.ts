import { queryClient } from "./queryClient";

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

interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
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
  active?: boolean;
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
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status} - ${response.statusText}` 
      }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Store auth token
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    return response;
  }

  async signup(userData: SignupRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    // Store auth token
    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));

    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    queryClient.clear();
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
  async getClasses(): Promise<any[]> {
    return this.request('/classes');
  }

  async getClassTypes(): Promise<any[]> {
    return this.request('/class-types');
  }

  // Membership Plans
  async getMembershipPlans(): Promise<any[]> {
    return this.request('/membership-plans');
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