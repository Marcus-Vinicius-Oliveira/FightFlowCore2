import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, TestAcademy } from '../helpers/test-utils';

/**
 * 4. Performance e integração (UI atual)
 *
 * Reescrito em 07/07/2026 contra a interface atual (o original referenciava
 * testids da primeira versão da UI).
 *
 * Orçamentos de performance assumem dev server local + banco Neon remoto —
 * são um teto de regressão grosseira, não um SLO.
 *
 * Convenção: nomes de academia contêm "E2E" para o slug casar com a faxina
 * de dados de teste (slug ~ 'e2e').
 */

async function authenticate(page: Page, academy: TestAcademy) {
  await page.addInitScript(([token, user]) => {
    localStorage.setItem('auth_token', token as string);
    localStorage.setItem('user', JSON.stringify(user));
  }, [academy.admin.token!, academy.admin.rawUser] as const);
}

function e2eData(prefix: string) {
  return TestHelpers.generateTestData(`E2E ${prefix}`);
}

/** Primeira ocorrência VISÍVEL do texto (páginas renderizam layout desktop + mobile). */
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true }).first();
}

test.describe('4. Performance e integração', () => {
  let helpers: TestHelpers;
  let academy: TestAcademy;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
  });

  test('Performance 4.1: Dashboard carrega dentro do orçamento', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Perf').academyA);
    await authenticate(page, academy);

    const start = Date.now();
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Painel da Academia');
    await expect(page.getByTestId('stat-alunos-ativos')).toBeVisible();
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    await expect(page.getByTestId('stat-aulas-ativas')).toBeVisible();
  });

  test('Performance 4.2: Lista de alunos com muitos registros', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Perf Alunos').academyA);
    const ts = Date.now();

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        helpers.createUser({
          name: `Aluno Perf ${String(i + 1).padStart(2, '0')}`,
          email: `aluno-perf-${i + 1}-${ts}@test.com`,
          password: 'Senha@123',
          role: 'ALUNO',
        }, academy.admin.token!)
      )
    );

    await authenticate(page, academy);
    const start = Date.now();
    await page.goto('/dashboard/alunos');
    const rows = page.locator('[data-testid^="row-student-"]:visible');
    await expect(rows.first()).toBeVisible();
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(5000);
    expect(await rows.count()).toBe(20);
  });

  test('Integration 4.3: API e front-end sincronizados nos dois sentidos', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Sync').academyA);
    const ts = Date.now();

    // API → UI: aluno criado via API aparece na lista
    const apiStudent = await helpers.createUser({
      name: `Aluno Via API ${ts}`,
      email: `aluno-api-${ts}@test.com`,
      password: 'Senha@123',
      role: 'ALUNO',
    }, academy.admin.token!);

    await authenticate(page, academy);
    await page.goto('/dashboard/alunos');
    await expect(visibleText(page, apiStudent.name)).toBeVisible();

    // UI → API: aluno criado pelo dialog aparece no GET /students
    const uiStudentName = `Aluno Via UI ${ts}`;
    const uiStudentEmail = `aluno-ui-${ts}@test.com`;
    await page.getByTestId('button-add-student').click();
    await page.getByTestId('input-student-name').fill(uiStudentName);
    await page.getByTestId('input-student-email').fill(uiStudentEmail);
    await page.getByTestId('input-student-password').fill('Senha@123');
    await page.getByTestId('button-submit-student').click();
    await expect(page.getByText('Aluno Adicionado').first()).toBeVisible();

    const studentsFromAPI = await helpers.apiRequest('GET', '/students', academy.admin.token!);
    expect(studentsFromAPI.ok).toBe(true);
    const uiStudentInAPI = studentsFromAPI.data.find((s: { email: string }) => s.email === uiStudentEmail);
    expect(uiStudentInAPI).toBeDefined();
    expect(uiStudentInAPI.name).toBe(uiStudentName);
  });

  test('Integration 4.4: Mudanças externas refletem ao recarregar', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Cache').academyA);
    await authenticate(page, academy);

    await page.goto('/dashboard/alunos');
    await expect(visibleText(page, 'Nenhum aluno cadastrado ainda.')).toBeVisible();

    // Cria aluno via API com a página aberta
    const newStudent = await helpers.createUser({
      name: `Aluno Cache ${Date.now()}`,
      email: `aluno-cache-${Date.now()}@test.com`,
      password: 'Senha@123',
      role: 'ALUNO',
    }, academy.admin.token!);

    await page.reload();
    await expect(visibleText(page, newStudent.name)).toBeVisible();
  });

  test('Integration 4.5: Fluxo completo — modalidade, aula e grade consistentes', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Fluxo Aulas').academyA);
    const instructor = await helpers.createUser({
      name: `Prof Integração ${Date.now()}`,
      email: `prof-integracao-${Date.now()}@test.com`,
      password: 'Senha@123',
      role: 'PROFESSOR',
    }, academy.admin.token!);
    await authenticate(page, academy);

    // 1. Modalidade pela UI (Configurações)
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Boxe' }).first().click();
    await expect(page.getByText('Modalidade "Boxe" adicionada!').first()).toBeVisible();

    // 2. Aula pela UI (Gestão de Aulas)
    await page.goto('/dashboard/aulas');
    await page.getByTestId('button-add-class').click();
    await page.getByText('Selecione o tipo de aula').click();
    await page.getByRole('option', { name: 'Boxe' }).click();
    await page.getByText('Selecione o professor').click();
    await page.getByRole('option', { name: instructor.name }).click();
    await page.locator('button[title="Terça-feira"]').click();
    await page.getByTestId('input-start-time').fill('20:00');
    await page.getByTestId('input-end-time').fill('21:15');
    await page.getByTestId('button-submit').click();
    await expect(page.getByText('20:00').first()).toBeVisible();

    // 3. Grade mostra a aula criada
    await page.goto('/dashboard/grade');
    await expect(page.locator('[data-testid^="class-card-"]').first()).toBeVisible();
    await expect(page.getByText('Boxe').first()).toBeVisible();
    await expect(page.getByText(instructor.name).first()).toBeVisible();

    // 4. API consistente com o que a UI criou (GET /classes devolve grupos
    //    com daysOfWeek — uma "turma" = N registros, um por dia)
    const classesFromAPI = await helpers.apiRequest('GET', '/classes', academy.admin.token!);
    expect(classesFromAPI.ok).toBe(true);
    const created = classesFromAPI.data.find(
      (c: { startTime: string; daysOfWeek: number[] }) => c.startTime === '20:00' && c.daysOfWeek.includes(2)
    );
    expect(created).toBeDefined();
  });

  test('Error Handling 4.6: Falha de rede ao criar aluno mostra erro e preserva o formulário', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Erro').academyA);
    await authenticate(page, academy);

    await page.goto('/dashboard/alunos');
    await expect(page.locator('h1')).toContainText('Gerenciamento de Alunos');

    // Derruba só o POST de criação (o GET da lista continua funcionando)
    await page.route('**/api/students', route =>
      route.request().method() === 'POST' ? route.abort() : route.continue()
    );

    await page.getByTestId('button-add-student').click();
    await page.getByTestId('input-student-name').fill('Aluno Erro Rede');
    await page.getByTestId('input-student-email').fill(`aluno-erro-${Date.now()}@test.com`);
    await page.getByTestId('input-student-password').fill('Senha@123');
    await page.getByTestId('button-submit-student').click();

    // Toast de erro e dialog continua aberto com os dados preenchidos
    await expect(page.getByText('Erro ao Adicionar Aluno').first()).toBeVisible();
    await expect(page.getByTestId('input-student-name')).toHaveValue('Aluno Erro Rede');
  });

  test('Security 4.7: Nome malicioso não executa script (XSS)', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('XSS').academyA);
    await authenticate(page, academy);

    // Qualquer dialog nativo (alert) = XSS executou = falha imediata
    page.on('dialog', dialog => {
      throw new Error(`XSS executou um dialog nativo: ${dialog.message()}`);
    });

    const maliciousName = '<script>alert("XSS")</script>';
    await page.goto('/dashboard/alunos');
    await page.getByTestId('button-add-student').click();
    await page.getByTestId('input-student-name').fill(maliciousName);
    await page.getByTestId('input-student-email').fill(`xss-${Date.now()}@test.com`);
    await page.getByTestId('input-student-password').fill('Senha@123');
    await page.getByTestId('button-submit-student').click();
    await expect(page.getByText('Aluno Adicionado').first()).toBeVisible();

    // O nome aparece como texto escapado na lista, não como tag
    await expect(visibleText(page, maliciousName)).toBeVisible();
    expect(await page.locator('script:has-text("XSS")').count()).toBe(0);
  });

  test('Accessibility 4.8: Navegação por teclado e labels de formulário', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('A11y').academyA);
    await authenticate(page, academy);

    // Itens da sidebar têm nome acessível
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Painel da Academia');
    for (const item of await page.locator('[data-testid^="sidebar-"]').all()) {
      expect((await item.textContent())?.trim()).toBeTruthy();
    }

    // Inputs com id no dialog de aluno têm <label for> correspondente
    await page.goto('/dashboard/alunos');
    await page.getByTestId('button-add-student').click();
    await expect(page.getByTestId('input-student-name')).toBeVisible();
    const inputs = page.locator('[role="dialog"] input[id]');
    expect(await inputs.count()).toBeGreaterThan(0);
    for (const input of await inputs.all()) {
      const id = await input.getAttribute('id');
      await expect(page.locator(`[role="dialog"] label[for="${id}"]`)).toBeAttached();
    }

    // Dialog fecha com Escape (padrão de teclado)
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('input-student-name')).toBeHidden();
  });
});
