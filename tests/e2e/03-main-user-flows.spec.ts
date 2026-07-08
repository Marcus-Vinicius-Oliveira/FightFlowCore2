import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { TestHelpers, TestAcademy } from '../helpers/test-utils';

/**
 * 3. Fluxos principais da aplicação (UI atual)
 *
 * Reescrito em 07/07/2026 contra a interface atual (o original navegava pela
 * UI da primeira versão, com testids que não existem mais).
 *
 * Convenção: nomes de academia contêm "E2E" para o slug casar com a faxina
 * de dados de teste (slug ~ 'e2e').
 */

/** Injeta token + user no localStorage (o client exige os dois) antes de navegar. */
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

test.describe('3. Fluxos principais da aplicação', () => {
  let helpers: TestHelpers;
  let academy: TestAcademy;

  test.beforeEach(async ({ page, request }) => {
    helpers = new TestHelpers(page, request);
  });

  test('Fluxo 3.1: Cadastro de academia pela UI e primeiro acesso ao dashboard', async ({ page }) => {
    const ts = Date.now();

    // Landing → botão de cadastro do Navbar
    await page.goto('/');
    await page.getByTestId('button-signup').click();
    await expect(page).toHaveURL('/cadastro');

    // Formulário de cadastro (campo de academia só aparece para o role admin)
    await page.getByTestId('input-signup-name').fill(`Admin Fluxo ${ts}`);
    await page.getByTestId('input-signup-email').fill(`admin-fluxo-${ts}@test.com`);
    await page.getByTestId('select-role').click();
    await page.getByRole('option', { name: 'Administrador da Academia' }).click();
    await page.getByTestId('input-academy-name').fill(`Academia E2E Fluxo ${ts}`);
    await page.getByTestId('input-signup-password').fill('Senha@123');
    await page.getByTestId('input-confirm-password').fill('Senha@123');
    await page.getByTestId('button-signup-submit').click();

    // Deve cair autenticado no dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Painel da Academia');

    // Métricas e navegação lateral visíveis
    await expect(page.getByTestId('stat-alunos-ativos')).toBeVisible();
    await expect(page.getByTestId('stat-aulas-ativas')).toBeVisible();
    await expect(page.getByTestId('sidebar-alunos')).toBeVisible();
    await expect(page.getByTestId('sidebar-grade-de-aulas')).toBeVisible();
  });

  test('Fluxo 3.2: Ciclo de gerenciamento de alunos (criar, listar, buscar)', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Alunos').academyA);
    await authenticate(page, academy);

    await page.goto('/dashboard/alunos');
    await expect(page.locator('h1')).toContainText('Gerenciamento de Alunos');

    // Adicionar aluno pelo dialog
    const ts = Date.now();
    const studentName = `Aluno Fluxo ${ts}`;
    await page.getByTestId('button-add-student').click();
    await page.getByTestId('input-student-name').fill(studentName);
    await page.getByTestId('input-student-email').fill(`aluno-fluxo-${ts}@test.com`);
    await page.getByTestId('input-student-phone').fill('(11) 99999-9999');
    await page.getByTestId('input-student-password').fill('Senha@123');
    await page.getByTestId('button-submit-student').click();

    await expect(page.getByText('Aluno Adicionado').first()).toBeVisible();
    await expect(visibleText(page, studentName)).toBeVisible();

    // Buscar filtra a lista; limpar a busca volta a exibir
    await page.getByTestId('input-search-students').filter({ visible: true }).first().fill(studentName);
    await expect(visibleText(page, studentName)).toBeVisible();
    await page.getByTestId('input-search-students').filter({ visible: true }).first().fill('nome-que-nao-existe-xyz');
    await expect(visibleText(page, 'Nenhum aluno encontrado com esse termo.')).toBeVisible();
    await page.getByTestId('input-search-students').filter({ visible: true }).first().fill('');
    await expect(visibleText(page, studentName)).toBeVisible();
  });

  test('Fluxo 3.3: Criação de modalidade (Configurações) e agendamento de aula', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Aulas').academyA);
    const instructor = await helpers.createUser({
      name: `Professor Fluxo ${Date.now()}`,
      email: `prof-fluxo-${Date.now()}@test.com`,
      password: 'Senha@123',
      role: 'PROFESSOR',
    }, academy.admin.token!);
    await authenticate(page, academy);

    // Modalidades são criadas em Configurações (chips de esportes comuns)
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Muay Thai' }).first().click();
    await expect(page.getByText('Modalidade "Muay Thai" adicionada!').first()).toBeVisible();

    // Agendar aula na Gestão de Aulas
    await page.goto('/dashboard/aulas');
    await page.getByTestId('button-add-class').click();

    await page.getByText('Selecione o tipo de aula').click();
    await page.getByRole('option', { name: 'Muay Thai' }).click();
    await page.getByText('Selecione o professor').click();
    await page.getByRole('option', { name: instructor.name }).click();
    await page.locator('button[title="Segunda-feira"]').click();
    await page.getByTestId('input-start-time').fill('18:00');
    await page.getByTestId('input-end-time').fill('19:00');
    await page.getByTestId('button-submit').click();

    // A turma aparece na listagem com horário e modalidade
    await expect(page.getByText('18:00').first()).toBeVisible();
    await expect(page.getByText('Muay Thai').first()).toBeVisible();
  });

  test('Fluxo 3.4: Visualização da grade horária semanal', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Grade').academyA);
    const ts = Date.now();

    const classType = await helpers.apiRequest('POST', '/classes/class-types', academy.admin.token!, {
      name: `BJJ Grade ${ts}`,
      description: 'Brazilian Jiu-Jitsu',
      duration: 90,
    });
    const instructor = await helpers.createUser({
      name: `Prof Grade ${ts}`,
      email: `prof-grade-${ts}@test.com`,
      password: 'Senha@123',
      role: 'PROFESSOR',
    }, academy.admin.token!);

    // Aulas em dias/horários variados para popular a grade
    for (const c of [
      { day: 1, start: '08:00', end: '09:30' },
      { day: 3, start: '19:00', end: '20:30' },
      { day: 5, start: '07:00', end: '08:30' },
    ]) {
      await helpers.apiRequest('POST', '/classes', academy.admin.token!, {
        classTypeId: classType.data.id,
        instructorId: instructor.id,
        dayOfWeek: c.day,
        startTime: c.start,
        endTime: c.end,
      });
    }

    await authenticate(page, academy);
    await page.goto('/dashboard/grade');

    await expect(page.locator('h1')).toContainText('Grade de Aulas');

    // Cards das aulas na grade, com modalidade, professor e horários
    const cards = page.locator('[data-testid^="class-card-"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBe(3);
    await expect(page.getByText(`BJJ Grade ${ts}`).first()).toBeVisible();
    await expect(page.getByText(instructor.name).first()).toBeVisible();
    await expect(page.getByText('08:00').first()).toBeVisible();
    await expect(page.getByText('19:00').first()).toBeVisible();
  });

  test('Fluxo 3.5: Login e logout de usuário existente', async ({ page }) => {
    academy = await helpers.createTestAcademy(e2eData('Login').academyA);

    // Login pela UI
    await page.goto('/login');
    await page.getByTestId('input-login-email').fill(academy.admin.email);
    await page.getByTestId('input-login-password').fill(academy.admin.password);
    await page.getByTestId('button-login-submit').click();

    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Painel da Academia');

    // Logout pela sidebar volta para a landing e limpa o token
    await page.getByTestId('button-logout').click();
    await expect(page).toHaveURL('/');
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('Fluxo 3.6: Validação de formulários e tratamento de erros', async ({ page }) => {
    // Cadastro vazio não navega (campos required semânticos do browser)
    await page.goto('/cadastro');
    await page.getByTestId('button-signup-submit').click();
    await expect(page).toHaveURL('/cadastro');

    // Medidor de força reage a senha fraca
    await page.getByTestId('input-signup-password').fill('123');
    await expect(page.getByTestId('password-strength-meter')).toContainText('Muito fraca');
    await page.getByTestId('input-signup-password').fill('Senha@123');
    await expect(page.getByTestId('password-strength-meter')).not.toContainText('Muito fraca');

    // Login com credenciais erradas mostra erro e não navega
    await page.goto('/login');
    await page.getByTestId('input-login-email').fill(`nao-existe-${Date.now()}@test.com`);
    await page.getByTestId('input-login-password').fill('SenhaErrada@1');
    await page.getByTestId('button-login-submit').click();
    await expect(page).toHaveURL('/login');
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
  });

  test('Fluxo 3.7: Responsividade mobile (bottom nav e formulários)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    academy = await helpers.createTestAcademy(e2eData('Mobile').academyA);
    await authenticate(page, academy);

    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Painel da Academia');

    // No mobile a navegação principal é a bottom nav (sidebar fica oculta)
    const bottomNav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(bottomNav).toBeVisible();

    // Navegar para Alunos pela bottom nav
    await bottomNav.getByText('Alunos').click();
    await expect(page).toHaveURL('/dashboard/alunos');
    await expect(page.locator('h1')).toContainText('Gerenciamento de Alunos');

    // Formulário de aluno utilizável no viewport mobile
    await page.getByTestId('button-add-student').click();
    await expect(page.getByTestId('input-student-name')).toBeVisible();
    await expect(page.getByTestId('button-submit-student')).toBeVisible();
  });
});
