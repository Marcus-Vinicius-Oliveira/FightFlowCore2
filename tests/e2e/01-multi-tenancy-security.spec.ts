import { test, expect } from '@playwright/test';
import { TestHelpers, TestAcademy, TestUser } from '../helpers/test-utils';

test.describe('Testes Críticos de Segurança - Multi-Tenancy', () => {
  let helpers: TestHelpers;
  let academyA: TestAcademy;
  let academyB: TestAcademy;
  let studentA1: TestUser;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
    
    // Generate unique test data for this test run
    const testData = TestHelpers.generateTestData('SECURITY');
    
    // Create two separate academies with their admin users
    academyA = await helpers.createTestAcademy(testData.academyA);
    academyB = await helpers.createTestAcademy(testData.academyB);
  });

  test.afterEach(async () => {
    await helpers.cleanup();
  });

  test('Cenário 1.1: Isolamento de Dados na Listagem (GET) - Academia A não deve ver dados da Academia B', async ({ page }) => {
    // Setup: Authenticate as Admin A and create a student with unique identifier
    await helpers.authenticate(academyA.admin.token!);
    
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    studentA1 = await helpers.createUser({
      name: `Student A1 ${uniqueId}`,
      email: `student-a1-${uniqueId}@test.com`,
      password: '123456',
      role: 'ALUNO'
    }, academyA.admin.token!);

    // Verify student was created in Academy A (check by unique email)
    const studentsInA = await helpers.apiRequest('GET', '/students', academyA.admin.token!);
    expect(studentsInA.ok).toBe(true);
    
    // Check that our specific student exists in Academy A
    const studentExistsInA = studentsInA.data?.some((s: any) => s.email === studentA1.email) || false;
    expect(studentExistsInA).toBe(true);

    // Critical Test: Authenticate as Admin B and try to list students
    const studentsInB = await helpers.apiRequest('GET', '/students', academyB.admin.token!);
    
    // Validation: Admin B should NOT see students from Academy A
    expect(studentsInB.ok).toBe(true);
    
    // Check that our Academy A student does NOT exist in Academy B's list
    const studentExistsInB = studentsInB.data?.some((s: any) => s.email === studentA1.email) || false;
    expect(studentExistsInB).toBe(false);
  });

  test('Cenário 1.2: Prevenção de Acesso Direto (GET por ID) - Admin B não deve acessar student da Academia A', async () => {
    // Setup: Create student in Academy A
    await helpers.authenticate(academyA.admin.token!);
    
    studentA1 = await helpers.createUser({
      name: 'Student A1 Direct Access',
      email: `student-a1-direct-${Date.now()}@test.com`,
      password: '123456',
      role: 'ALUNO'
    }, academyA.admin.token!);

    // Verify student exists and get its ID
    expect(studentA1.id).toBeDefined();

    // Critical Test: Admin B tries to access student from Academy A by ID
    const directAccessResult = await helpers.apiRequest(
      'GET', 
      `/students/${studentA1.id}`, 
      academyB.admin.token!
    );

    // Validation: Should return 403 Forbidden or 404 Not Found
    expect(directAccessResult.ok).toBe(false);
    expect([403, 404]).toContain(directAccessResult.status);
    expect(directAccessResult.data).toBeNull();
  });

  test('Cenário 1.3: Isolamento na Criação de Aulas - Academy B não deve ver class types da Academy A', async () => {
    // Setup: Admin A creates a class type
    const classTypeData = {
      name: `Muay Thai Academy A ${Date.now()}`,
      description: 'Arte marcial tailandesa',
      duration: 60
    };

    const classTypeResult = await helpers.apiRequest(
      'POST',
      '/class-types',
      academyA.admin.token!,
      classTypeData
    );

    expect(classTypeResult.ok).toBe(true);
    expect(classTypeResult.data.name).toBe(classTypeData.name);

    // Verify Admin A can see the class type
    const classTypesInA = await helpers.apiRequest('GET', '/class-types', academyA.admin.token!);
    expect(classTypesInA.ok).toBe(true);
    expect(classTypesInA.data.length).toBeGreaterThan(0);
    
    const classTypeExists = classTypesInA.data.some((ct: any) => ct.name === classTypeData.name);
    expect(classTypeExists).toBe(true);

    // Critical Test: Admin B should not see Academy A's class types
    const classTypesInB = await helpers.apiRequest('GET', '/class-types', academyB.admin.token!);
    expect(classTypesInB.ok).toBe(true);
    
    const classTypeExistsInB = classTypesInB.data?.some((ct: any) => ct.name === classTypeData.name) || false;
    expect(classTypeExistsInB).toBe(false);
  });

  test('Cenário 1.4: Isolamento de Instrutores - Admin B não deve ver instructors da Academy A', async () => {
    // Setup: Create an instructor in Academy A
    const instructorA = await helpers.createUser({
      name: `Instructor A ${Date.now()}`,
      email: `instructor-a-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academyA.admin.token!);

    // Verify instructor was created in Academy A
    const instructorsInA = await helpers.apiRequest('GET', '/instructors', academyA.admin.token!);
    expect(instructorsInA.ok).toBe(true);
    
    const instructorExistsInA = instructorsInA.data?.some((i: any) => i.email === instructorA.email) || false;
    expect(instructorExistsInA).toBe(true);

    // Critical Test: Admin B should not see instructors from Academy A
    const instructorsInB = await helpers.apiRequest('GET', '/instructors', academyB.admin.token!);
    expect(instructorsInB.ok).toBe(true);
    
    const instructorExistsInB = instructorsInB.data?.some((i: any) => i.email === instructorA.email) || false;
    expect(instructorExistsInB).toBe(false);
  });

  test('Cenário 1.5: Isolamento de Classes - Admin B não deve ver classes da Academy A', async () => {
    // Setup: Admin A creates class type and instructor
    const classTypeResult = await helpers.apiRequest(
      'POST',
      '/class-types',
      academyA.admin.token!,
      {
        name: `BJJ Academy A ${Date.now()}`,
        description: 'Jiu-Jitsu Brasileiro',
        duration: 90
      }
    );

    const instructorA = await helpers.createUser({
      name: `Prof A ${Date.now()}`,
      email: `prof-a-${Date.now()}@test.com`,
      password: '123456',
      role: 'PROFESSOR'
    }, academyA.admin.token!);

    // Create a class in Academy A
    const classData = {
      classTypeId: classTypeResult.data.id,
      instructorId: instructorA.id,
      dayOfWeek: 1, // Monday
      startTime: '18:00',
      endTime: '19:30'
    };

    const classResult = await helpers.apiRequest(
      'POST',
      '/classes',
      academyA.admin.token!,
      classData
    );

    expect(classResult.ok).toBe(true);

    // Verify class exists in Academy A
    const classesInA = await helpers.apiRequest('GET', '/classes', academyA.admin.token!);
    expect(classesInA.ok).toBe(true);
    expect(classesInA.data.length).toBeGreaterThan(0);

    // Critical Test: Admin B should not see classes from Academy A
    const classesInB = await helpers.apiRequest('GET', '/classes', academyB.admin.token!);
    expect(classesInB.ok).toBe(true);
    
    // Check that the specific class from Academy A does not exist in Academy B's list
    const classExistsInB = classesInB.data?.some((c: any) => c.id === classResult.data.id) || false;
    expect(classExistsInB).toBe(false);
  });
});