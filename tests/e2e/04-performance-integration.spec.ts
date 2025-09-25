import { test, expect } from '@playwright/test';
import { TestHelpers, TestAcademy, TestUser } from '../helpers/test-utils';

test.describe('Testes de Performance e Integração', () => {
  let helpers: TestHelpers;
  let academy: TestAcademy;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('Performance 4.1: Carregamento rápido do dashboard', async ({ page }) => {
    const testData = TestHelpers.generateTestData('PERF');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    const startTime = Date.now();
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Wait for main content to load
    await expect(page.locator('h1')).toContainText('Painel da Academia');
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check that key metrics are visible
    await expect(page.locator('[data-testid="metric-students"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-classes"]')).toBeVisible();
  });

  test('Performance 4.2: Lista de alunos com muitos registros', async ({ page }) => {
    const testData = TestHelpers.generateTestData('PERF-STUDENTS');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Create multiple students via API for performance testing
    const studentPromises: Promise<TestUser>[] = [];
    for (let i = 0; i < 20; i++) {
      studentPromises.push(
        helpers.createUser({
          name: `Performance Student ${i + 1}`,
          email: `perf-student-${i + 1}-${Date.now()}@test.com`,
          password: '123456',
          role: 'ALUNO'
        }, academy.admin.token!)
      );
    }
    
    await Promise.all(studentPromises);
    
    const startTime = Date.now();
    
    // Navigate to students page
    await page.goto('/dashboard/alunos');
    
    // Wait for students list to load
    await expect(page.locator('[data-testid="students-table"]')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    
    // Students page should load within 5 seconds even with many records
    expect(loadTime).toBeLessThan(5000);
    
    // Check that students are displayed
    const studentRows = page.locator('[data-testid*="student-row"]');
    await expect(studentRows.first()).toBeVisible();
  });

  test('Integration 4.3: API consistency - Front-end e back-end sincronizados', async ({ page }) => {
    const testData = TestHelpers.generateTestData('INTEGRATION');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Create student via API
    const apiStudent = await helpers.createUser({
      name: `API Integration Student ${Date.now()}`,
      email: `api-integration-${Date.now()}@test.com`,
      password: '123456',
      role: 'ALUNO'
    }, academy.admin.token!);
    
    // Verify student appears in UI
    await page.goto('/dashboard/alunos');
    
    // Should see the student created via API
    await expect(page.locator(`text=${apiStudent.name}`)).toBeVisible();
    await expect(page.locator(`text=${apiStudent.email}`)).toBeVisible();
    
    // Create student via UI
    await page.click('[data-testid="button-add-student"]');
    
    const uiStudentName = `UI Integration Student ${Date.now()}`;
    const uiStudentEmail = `ui-integration-${Date.now()}@test.com`;
    
    await page.fill('[data-testid="input-name"]', uiStudentName);
    await page.fill('[data-testid="input-email"]', uiStudentEmail);
    await page.click('[data-testid="button-submit"]');
    
    // Verify student appears in API
    const studentsFromAPI = await helpers.apiRequest('GET', '/students', academy.admin.token!);
    expect(studentsFromAPI.ok).toBe(true);
    
    const uiStudentInAPI = studentsFromAPI.data.find((s: any) => s.email === uiStudentEmail);
    expect(uiStudentInAPI).toBeDefined();
    expect(uiStudentInAPI.name).toBe(uiStudentName);
  });

  test('Integration 4.4: Cache invalidation - Mudanças refletem imediatamente', async ({ page }) => {
    const testData = TestHelpers.generateTestData('CACHE');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Navigate to students page
    await page.goto('/dashboard/alunos');
    
    // Initial state should have no students
    await expect(page.locator('text=Nenhum aluno cadastrado')).toBeVisible();
    
    // Create student via API while page is open
    const newStudent = await helpers.createUser({
      name: `Cache Test Student ${Date.now()}`,
      email: `cache-test-${Date.now()}@test.com`,
      password: '123456',
      role: 'ALUNO'
    }, academy.admin.token!);
    
    // Refresh page to check if cache is invalidated
    await page.reload();
    
    // Student should appear immediately after refresh
    await expect(page.locator(`text=${newStudent.name}`)).toBeVisible();
  });

  test('Integration 4.5: Fluxo completo de gerenciamento de aulas', async ({ page }) => {
    const testData = TestHelpers.generateTestData('CLASS-FLOW');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Step 1: Create instructor via API
    const instructor = await helpers.createUser({
      name: `Flow Instructor ${Date.now()}`,
      email: `flow-instructor-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academy.admin.token!);
    
    // Step 2: Create class type via UI
    await page.goto('/dashboard/aulas');
    await page.click('[data-testid="tab-modalidades"]');
    await page.click('[data-testid="button-add-modality"]');
    
    const modalityName = `Flow Muay Thai ${Date.now()}`;
    await page.fill('[data-testid="input-name"]', modalityName);
    await page.fill('[data-testid="input-description"]', 'End-to-end test modality');
    await page.fill('[data-testid="input-duration"]', '75');
    await page.click('[data-testid="button-submit"]');
    
    // Step 3: Create class using the modality and instructor
    await page.click('[data-testid="tab-cronograma"]');
    await page.click('[data-testid="button-schedule-class"]');
    
    await page.click('[data-testid="select-modality"]');
    await page.click(`text=${modalityName}`);
    
    await page.click('[data-testid="select-instructor"]');
    await page.click(`text=${instructor.name}`);
    
    await page.selectOption('[data-testid="select-day"]', '2'); // Tuesday
    await page.fill('[data-testid="input-start-time"]', '20:00');
    await page.fill('[data-testid="input-end-time"]', '21:15');
    await page.click('[data-testid="button-submit"]');
    
    // Step 4: Verify class appears in schedule
    await page.goto('/dashboard/grade');
    
    await expect(page.locator('text=20:00')).toBeVisible();
    await expect(page.locator(`text=${modalityName}`)).toBeVisible();
    await expect(page.locator(`text=${instructor.name}`)).toBeVisible();
    
    // Step 5: Verify via API that everything is consistent
    const classesFromAPI = await helpers.apiRequest('GET', '/classes', academy.admin.token!);
    expect(classesFromAPI.ok).toBe(true);
    expect(classesFromAPI.data.length).toBeGreaterThan(0);
    
    const createdClass = classesFromAPI.data.find((c: any) => 
      c.startTime === '20:00' && c.dayOfWeek === 2
    );
    expect(createdClass).toBeDefined();
  });

  test('Error Handling 4.6: Tratamento de erros de conectividade', async ({ page }) => {
    const testData = TestHelpers.generateTestData('ERROR');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Navigate to students page
    await page.goto('/dashboard/alunos');
    
    // Simulate network failure by intercepting requests
    await page.route('**/api/students', route => {
      route.abort();
    });
    
    // Try to add student - should handle error gracefully
    await page.click('[data-testid="button-add-student"]');
    await page.fill('[data-testid="input-name"]', 'Error Test Student');
    await page.fill('[data-testid="input-email"]', 'error-test@test.com');
    await page.click('[data-testid="button-submit"]');
    
    // Should show error message
    await expect(page.locator('.toast')).toContainText('erro');
  });

  test('Security 4.7: Proteção contra ataques XSS', async ({ page }) => {
    const testData = TestHelpers.generateTestData('XSS');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Try to inject script in student name
    await page.goto('/dashboard/alunos');
    await page.click('[data-testid="button-add-student"]');
    
    const maliciousName = '<script>alert("XSS")</script>';
    
    await page.fill('[data-testid="input-name"]', maliciousName);
    await page.fill('[data-testid="input-email"]', 'xss-test@test.com');
    await page.click('[data-testid="button-submit"]');
    
    // Script should not execute - content should be escaped
    await expect(page.locator('text=<script>')).toBeVisible(); // Should show as text, not execute
    
    // No alert should have been shown
    expect(page.locator('role=alert')).toHaveCount(0);
  });

  test('Accessibility 4.8: Navegação por teclado e leitores de tela', async ({ page }) => {
    const testData = TestHelpers.generateTestData('A11Y');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    await page.goto('/dashboard');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Should focus first navigable element
    await page.keyboard.press('Enter'); // Should activate focused element
    
    // Check for proper ARIA labels
    const navItems = page.locator('[role="navigation"] a');
    for (const item of await navItems.all()) {
      const ariaLabel = await item.getAttribute('aria-label');
      const textContent = await item.textContent();
      
      // Should have either aria-label or meaningful text content
      expect(ariaLabel || textContent?.trim()).toBeTruthy();
    }
    
    // Check form labels
    await page.goto('/dashboard/alunos');
    await page.click('[data-testid="button-add-student"]');
    
    const inputs = page.locator('input');
    for (const input of await inputs.all()) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });
});