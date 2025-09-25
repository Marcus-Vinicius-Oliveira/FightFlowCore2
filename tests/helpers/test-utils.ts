import { Page, expect } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';

export interface TestUser {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO';
  academyName?: string;
  token?: string;
  createdByAdminToken?: string; // Track which admin token was used to create this user
}

export interface TestAcademy {
  id?: string;
  name: string;
  slug?: string;
  admin: TestUser;
}

export class TestHelpers {
  private createdAcademies: TestAcademy[] = [];
  private createdUsers: TestUser[] = [];

  constructor(
    private page: Page,
    private request: APIRequestContext
  ) {}

  /**
   * Creates a test academy with admin user via signup
   */
  async createTestAcademy(academyData: TestAcademy): Promise<TestAcademy> {
    // Navigate to signup page
    await this.page.goto('/');
    await this.page.click('[data-testid="link-signup"]');
    
    // Fill signup form
    await this.page.fill('[data-testid="input-name"]', academyData.admin.name);
    await this.page.fill('[data-testid="input-email"]', academyData.admin.email);
    await this.page.fill('[data-testid="input-password"]', academyData.admin.password);
    await this.page.fill('[data-testid="input-academy-name"]', academyData.name);
    
    // Submit signup
    await this.page.click('[data-testid="button-signup"]');
    
    // Wait for redirect to dashboard
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Extract auth token from localStorage
    const token = await this.page.evaluate(() => localStorage.getItem('auth_token'));
    
    if (!token) {
      throw new Error('Failed to get auth token after signup');
    }

    academyData.admin.token = token;
    
    // Track for cleanup
    this.createdAcademies.push(academyData);
    
    return academyData;
  }

  /**
   * Creates a user (student or instructor) via API
   */
  async createUser(userData: Omit<TestUser, 'token'>, adminToken: string): Promise<TestUser> {
    const endpoint = userData.role === 'PROFESSOR' ? '/api/instructors' : '/api/students';
    
    const response = await this.request.post(endpoint, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to create user: ${error}`);
    }

    const createdUser = await response.json();
    const userWithToken = {
      ...userData,
      id: createdUser.id,
      createdByAdminToken: adminToken, // Store the admin token used to create this user
    };
    
    // Track for cleanup
    this.createdUsers.push(userWithToken);
    
    return userWithToken;
  }

  /**
   * Logs in a user and returns their JWT token
   */
  async loginUser(email: string, password: string): Promise<string> {
    const response = await this.request.post('/api/auth/login', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email,
        password,
      },
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Failed to login user ${email}: ${error}`);
    }

    const loginData = await response.json();
    return loginData.token;
  }

  /**
   * Authenticates with stored credentials
   */
  async authenticate(token: string): Promise<void> {
    await this.page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken);
    }, token);
  }

  /**
   * Makes an authenticated API request
   */
  async apiRequest(
    method: string,
    endpoint: string,
    token: string,
    data?: any
  ): Promise<any> {
    const response = await this.request.fetch(`/api${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: data ? JSON.stringify(data) : undefined,
    });

    return {
      status: response.status(),
      ok: response.ok(),
      data: response.ok() ? await response.json().catch(() => null) : null,
      error: !response.ok() ? await response.text() : null,
    };
  }

  /**
   * Cleans up test data by logging out and clearing created resources
   */
  async cleanup(): Promise<void> {
    // Clear browser storage
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Cleanup created users using their specific admin tokens
    for (const user of this.createdUsers) {
      try {
        if (user.id && user.createdByAdminToken) {
          const endpoint = user.role === 'PROFESSOR' ? '/instructors' : '/students';
          await this.request.delete(`/api${endpoint}/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${user.createdByAdminToken}`,
            },
          });
        }
      } catch (error) {
        console.warn(`Failed to cleanup user ${user.email}:`, error);
      }
    }
    this.createdUsers = [];
    
    // Note: Academy cleanup is complex due to foreign key constraints
    // In a real implementation, we'd need proper cascade deletion or a test-only cleanup endpoint
    this.createdAcademies = [];
  }

  /**
   * Generates unique test data
   */
  static generateTestData(prefix: string) {
    const timestamp = Date.now();
    return {
      academyA: {
        name: `${prefix} Academia A ${timestamp}`,
        admin: {
          name: `Admin A ${timestamp}`,
          email: `admin-a-${timestamp}@test.com`,
          password: '123456',
          role: 'ADMIN_ACADEMIA' as const,
        },
      },
      academyB: {
        name: `${prefix} Academia B ${timestamp}`,
        admin: {
          name: `Admin B ${timestamp}`,
          email: `admin-b-${timestamp}@test.com`,
          password: '123456',
          role: 'ADMIN_ACADEMIA' as const,
        },
      },
    };
  }
}