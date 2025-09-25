import { test, expect } from '@playwright/test';
import { TestHelpers, TestAcademy } from '../helpers/test-utils';

test.describe('Fluxos Principais da Aplicação', () => {
  let helpers: TestHelpers;
  let academy: TestAcademy;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('Fluxo 3.1: Cadastro completo de academia e primeiro acesso ao dashboard', async ({ page }) => {
    const testData = TestHelpers.generateTestData('FLOW');
    
    // Navigate to homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/Centro de Lutas/);

    // Access signup page
    await page.click('[data-testid="link-signup"]');
    await expect(page).toHaveURL('/cadastro');

    // Fill signup form
    await page.fill('[data-testid="input-name"]', testData.academyA.admin.name);
    await page.fill('[data-testid="input-email"]', testData.academyA.admin.email);
    await page.fill('[data-testid="input-password"]', testData.academyA.admin.password);
    await page.fill('[data-testid="input-academy-name"]', testData.academyA.name);

    // Submit signup
    await page.click('[data-testid="button-signup"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Dashboard should show welcome information
    await expect(page.locator('h1')).toContainText('Painel da Academia');
    
    // Check if navigation items are visible
    await expect(page.locator('[data-testid="nav-alunos"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-aulas"]')).toBeVisible();
  });

  test('Fluxo 3.2: Ciclo completo de gerenciamento de alunos', async ({ page }) => {
    // Setup academy
    const testData = TestHelpers.generateTestData('STUDENTS');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Navigate to student management
    await page.goto('/dashboard/alunos');
    await expect(page.locator('h1')).toContainText('Gerenciamento de Alunos');

    // Add new student
    await page.click('[data-testid="button-add-student"]');
    
    // Fill student form
    const studentName = `Test Student ${Date.now()}`;
    const studentEmail = `student-${Date.now()}@test.com`;
    
    await page.fill('[data-testid="input-name"]', studentName);
    await page.fill('[data-testid="input-email"]', studentEmail);
    await page.fill('[data-testid="input-phone"]', '(11) 99999-9999');

    // Submit form
    await page.click('[data-testid="button-submit"]');
    
    // Should show success message
    await expect(page.locator('.toast')).toContainText('cadastrado com sucesso');
    
    // Student should appear in the list
    await expect(page.locator(`text=${studentName}`)).toBeVisible();
    await expect(page.locator(`text=${studentEmail}`)).toBeVisible();

    // Test search functionality
    await page.fill('[data-testid="input-search"]', studentName);
    await expect(page.locator(`text=${studentName}`)).toBeVisible();
    
    // Clear search
    await page.fill('[data-testid="input-search"]', '');
  });

  test('Fluxo 3.3: Criação de modalidades e agendamento de aulas', async ({ page }) => {
    // Setup academy
    const testData = TestHelpers.generateTestData('CLASSES');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Create instructor first via API
    const instructor = await helpers.createUser({
      name: `Professor Test ${Date.now()}`,
      email: `professor-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academy.admin.token!);

    // Navigate to class management
    await page.goto('/dashboard/aulas');
    
    // Test creating class type first
    await page.click('[data-testid="tab-modalidades"]');
    await page.click('[data-testid="button-add-modality"]');
    
    const modalityName = `Muay Thai ${Date.now()}`;
    await page.fill('[data-testid="input-name"]', modalityName);
    await page.fill('[data-testid="input-description"]', 'Arte marcial tailandesa');
    await page.fill('[data-testid="input-duration"]', '60');
    
    await page.click('[data-testid="button-submit"]');
    
    // Should show success message
    await expect(page.locator('.toast')).toContainText('criada com sucesso');
    
    // Now create a class
    await page.click('[data-testid="tab-cronograma"]');
    await page.click('[data-testid="button-schedule-class"]');
    
    // Fill class form
    await page.click('[data-testid="select-modality"]');
    await page.click(`text=${modalityName}`);
    
    await page.click('[data-testid="select-instructor"]');
    await page.click(`text=${instructor.name}`);
    
    await page.selectOption('[data-testid="select-day"]', '1'); // Monday
    await page.fill('[data-testid="input-start-time"]', '18:00');
    await page.fill('[data-testid="input-end-time"]', '19:00');
    
    await page.click('[data-testid="button-submit"]');
    
    // Should show success message
    await expect(page.locator('.toast')).toContainText('criada com sucesso');
    
    // Class should appear in schedule
    await expect(page.locator('text=18:00')).toBeVisible();
  });

  test('Fluxo 3.4: Visualização da grade horária semanal', async ({ page }) => {
    // Setup academy with class
    const testData = TestHelpers.generateTestData('SCHEDULE');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Create class type and instructor via API for faster setup
    const classTypeResult = await helpers.apiRequest(
      'POST',
      '/class-types',
      academy.admin.token!,
      {
        name: `BJJ Schedule ${Date.now()}`,
        description: 'Brazilian Jiu-Jitsu',
        duration: 90
      }
    );

    const instructor = await helpers.createUser({
      name: `Schedule Prof ${Date.now()}`,
      email: `schedule-prof-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academy.admin.token!);

    // Create multiple classes for schedule visualization
    const classesData = [
      { day: 1, start: '08:00', end: '09:30' }, // Monday morning
      { day: 1, start: '18:00', end: '19:30' }, // Monday evening
      { day: 3, start: '19:00', end: '20:30' }, // Wednesday evening
      { day: 5, start: '07:00', end: '08:30' }, // Friday morning
    ];

    for (const classData of classesData) {
      await helpers.apiRequest(
        'POST',
        '/classes',
        academy.admin.token!,
        {
          classTypeId: classTypeResult.data.id,
          instructorId: instructor.id,
          dayOfWeek: classData.day,
          startTime: classData.start,
          endTime: classData.end
        }
      );
    }

    // Navigate to schedule
    await page.goto('/dashboard/grade');
    
    // Should show weekly schedule grid
    await expect(page.locator('h1')).toContainText('Grade Horária');
    
    // Check for days of week
    await expect(page.locator('text=Segunda-feira')).toBeVisible();
    await expect(page.locator('text=Quarta-feira')).toBeVisible();
    await expect(page.locator('text=Sexta-feira')).toBeVisible();
    
    // Check for class times
    await expect(page.locator('text=08:00')).toBeVisible();
    await expect(page.locator('text=18:00')).toBeVisible();
    await expect(page.locator('text=19:00')).toBeVisible();
    
    // Check for class information
    await expect(page.locator(`text=${classTypeResult.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${instructor.name}`)).toBeVisible();
  });

  test('Fluxo 3.5: Login e logout de usuário existente', async ({ page }) => {
    // Setup academy
    const testData = TestHelpers.generateTestData('LOGIN');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Logout
    await helpers.cleanup();
    
    // Go to login page
    await page.goto('/login');
    
    // Fill login form
    await page.fill('[data-testid="input-email"]', academy.admin.email);
    await page.fill('[data-testid="input-password"]', academy.admin.password);
    
    // Submit login
    await page.click('[data-testid="button-login"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Painel da Academia');
    
    // Test logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="button-logout"]');
    
    // Should redirect to homepage
    await expect(page).toHaveURL('/');
  });

  test('Fluxo 3.6: Validação de formulários e tratamento de erros', async ({ page }) => {
    // Navigate to signup with invalid data
    await page.goto('/cadastro');
    
    // Try to submit empty form
    await page.click('[data-testid="button-signup"]');
    
    // Should show validation errors
    const errorElements = page.locator('.error, .text-destructive');
    await expect(errorElements.first()).toBeVisible();
    
    // Test invalid email format
    await page.fill('[data-testid="input-name"]', 'Test User');
    await page.fill('[data-testid="input-email"]', 'invalid-email');
    await page.fill('[data-testid="input-password"]', '123');
    await page.fill('[data-testid="input-academy-name"]', 'Test Academy');
    
    await page.click('[data-testid="button-signup"]');
    
    // Should show email validation error
    await expect(page.locator('text=email')).toBeVisible();
  });

  test('Fluxo 3.7: Responsividade em dispositivos móveis', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    const testData = TestHelpers.generateTestData('MOBILE');
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Test navigation on mobile
    await page.goto('/dashboard');
    
    // Should have mobile-friendly navigation
    await expect(page.locator('[data-testid="nav-alunos"]')).toBeVisible();
    
    // Test student management on mobile
    await page.goto('/dashboard/alunos');
    await expect(page.locator('h1')).toContainText('Gerenciamento de Alunos');
    
    // Forms should be mobile-friendly
    await page.click('[data-testid="button-add-student"]');
    await expect(page.locator('[data-testid="input-name"]')).toBeVisible();
  });
});