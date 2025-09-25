import { test, expect } from '@playwright/test';
import { TestHelpers, TestAcademy, TestUser } from '../helpers/test-utils';

test.describe('Testes de Controle de Acesso por Papel (RBAC)', () => {
  let helpers: TestHelpers;
  let academy: TestAcademy;
  let professor: TestUser;
  let student: TestUser;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
    
    // Generate unique test data for this test run
    const testData = TestHelpers.generateTestData('RBAC');
    
    // Create academy with admin
    academy = await helpers.createTestAcademy(testData.academyA);
    
    // Create professor and student users
    professor = await helpers.createUser({
      name: `Professor RBAC ${Date.now()}`,
      email: `professor-rbac-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academy.admin.token!);

    student = await helpers.createUser({
      name: `Student RBAC ${Date.now()}`,
      email: `student-rbac-${Date.now()}@test.com`,
      password: '123456',
      role: 'ALUNO'
    }, academy.admin.token!);
    
    // Get actual tokens for professor and student via login
    professor.token = await helpers.loginUser(professor.email, professor.password);
    student.token = await helpers.loginUser(student.email, student.password);
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('Cenário 2.1: Professor NÃO deve conseguir criar novos alunos', async () => {
    // Try to create student as professor (should fail with 403 - forbidden)
    const createStudentResult = await helpers.apiRequest(
      'POST',
      '/students',
      professor.token!, // Now using real professor token
      {
        name: 'Unauthorized Student',
        email: `unauthorized-${Date.now()}@test.com`,
        password: '123456', // Include required password field
        role: 'ALUNO'
      }
    );

    // Should fail with 403 (forbidden) - professor authenticated but lacks permission
    expect(createStudentResult.ok).toBe(false);
    expect(createStudentResult.status).toBe(403);
  });

  test('Cenário 2.2: Professor PODE ler classes mas NÃO pode criar class types', async () => {
    // Professor should be able to read classes (they need this for teaching)
    const readClassesResult = await helpers.apiRequest(
      'GET',
      '/classes',
      professor.token!
    );
    
    expect(readClassesResult.ok).toBe(true);
    expect(readClassesResult.status).toBe(200);
    
    // But should NOT be able to create class types (admin-only)
    const createClassTypeResult = await helpers.apiRequest(
      'POST',
      '/class-types',
      professor.token!,
      {
        name: 'Unauthorized Class Type',
        description: 'Should not be created',
        duration: 60
      }
    );

    expect(createClassTypeResult.ok).toBe(false);
    expect(createClassTypeResult.status).toBe(403);
  });

  test('Cenário 2.3: Aluno NÃO deve ter acesso a endpoints administrativos', async () => {
    // Test various admin endpoints that students should not access
    const adminOnlyEndpoints = [
      '/students',     // Student management is admin-only
      '/instructors',  // Instructor management is admin-only
      '/class-types'   // Class type management is admin-only
    ];

    for (const endpoint of adminOnlyEndpoints) {
      const result = await helpers.apiRequest('GET', endpoint, student.token!);
      
      // Should fail with 403 (forbidden) - student authenticated but lacks permission
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
    }
    
    // But students should be able to see class schedule
    const classesResult = await helpers.apiRequest('GET', '/classes', student.token!);
    expect(classesResult.ok).toBe(true);
    expect(classesResult.status).toBe(200);
  });

  test('Cenário 2.4: Admin deve ter acesso completo a todos os recursos', async () => {
    // Test that admin can access all endpoints
    const adminEndpoints = [
      '/students',
      '/instructors', 
      '/class-types',
      '/classes'
    ];

    for (const endpoint of adminEndpoints) {
      const result = await helpers.apiRequest('GET', endpoint, academy.admin.token!);
      
      // Admin should have access to all endpoints
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    }
  });

  test('Cenário 2.5: Admin pode criar e gerenciar todos os tipos de usuário', async () => {
    // Create student with complete payload
    const newStudent = await helpers.apiRequest(
      'POST',
      '/students',
      academy.admin.token!,
      {
        name: `Admin Created Student ${Date.now()}`,
        email: `admin-student-${Date.now()}@test.com`,
        password: '123456',
        role: 'ALUNO'
      }
    );

    expect(newStudent.ok).toBe(true);
    expect(newStudent.data.role).toBe('ALUNO');

    // Create instructor using correct endpoint
    const newInstructor = await helpers.apiRequest(
      'POST',
      '/instructors',
      academy.admin.token!,
      {
        name: `Admin Created Instructor ${Date.now()}`,
        email: `admin-instructor-${Date.now()}@test.com`,
        password: '123456',
        role: 'PROFESSOR'
      }
    );

    expect(newInstructor.ok).toBe(true);
    expect(newInstructor.data.role).toBe('PROFESSOR');

    // Verify they appear in respective lists
    const students = await helpers.apiRequest('GET', '/students', academy.admin.token!);
    const instructors = await helpers.apiRequest('GET', '/instructors', academy.admin.token!);

    expect(students.data.some((s: any) => s.email === newStudent.data.email)).toBe(true);
    expect(instructors.data.some((i: any) => i.email === newInstructor.data.email)).toBe(true);
  });

  test('Cenário 2.6: Admin pode criar class types e classes completas', async () => {
    // Create class type
    const classType = await helpers.apiRequest(
      'POST',
      '/class-types',
      academy.admin.token!,
      {
        name: `Admin Class Type ${Date.now()}`,
        description: 'Class type created by admin',
        duration: 60
      }
    );

    expect(classType.ok).toBe(true);

    // Create instructor for the class
    const instructor = await helpers.apiRequest(
      'POST',
      '/instructors',
      academy.admin.token!,
      {
        name: `Class Instructor ${Date.now()}`,
        email: `class-instructor-${Date.now()}@test.com`,
        password: '123456',
        role: 'PROFESSOR'
      }
    );

    expect(instructor.ok).toBe(true);

    // Create class
    const newClass = await helpers.apiRequest(
      'POST',
      '/classes',
      academy.admin.token!,
      {
        classTypeId: classType.data.id,
        instructorId: instructor.data.id,
        dayOfWeek: 2, // Tuesday
        startTime: '19:00',
        endTime: '20:30'
      }
    );

    expect(newClass.ok).toBe(true);
    expect(newClass.data.dayOfWeek).toBe(2);

    // Verify class appears in classes list
    const classes = await helpers.apiRequest('GET', '/classes', academy.admin.token!);
    expect(classes.data.some((c: any) => c.id === newClass.data.id)).toBe(true);
  });

  test('Cenário 2.7: Verificação de tokens inválidos ou expirados', async () => {
    const invalidToken = 'invalid-token-12345';
    
    // Test with invalid token
    const result = await helpers.apiRequest('GET', '/students', invalidToken);
    
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('Cenário 2.8: Verificação de requisições sem token', async () => {
    // Test without token
    const result = await helpers.apiRequest('GET', '/students', '');
    
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});