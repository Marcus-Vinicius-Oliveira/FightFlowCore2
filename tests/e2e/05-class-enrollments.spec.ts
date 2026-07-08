import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * 5. Fluxo completo de matrícula em turma (UI)
 *
 * Cobre o caminho feliz de ponta a ponta:
 * abrir turma → matricular aluno → ocupação atualiza → registrar presença
 * do aluno → remover matrícula.
 *
 * O teste cria uma academia isolada via signup e os dados de apoio
 * (professor, modalidade, turma, plano, aluno) via API.
 */

interface Ctx {
  token: string;
  user: unknown;
  classId: string;
  studentId: string;
  studentName: string;
  planName: string;
}

async function api(request: APIRequestContext, token: string, method: string, url: string, data?: unknown) {
  const res = await request.fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok()) {
    throw new Error(`${method} ${url} → ${res.status()}: ${await res.text()}`);
  }
  return res.json();
}

async function setupAcademy(request: APIRequestContext): Promise<Ctx> {
  const ts = Date.now();

  const signup = await request.post('/api/auth/signup', {
    headers: { 'Content-Type': 'application/json' },
    data: {
      name: `Admin Matrícula ${ts}`,
      email: `admin-matricula-${ts}@test.com`,
      password: 'Senha@123',
      role: 'ADMIN_ACADEMIA',
      academyName: `Academia Matrícula E2E ${ts}`,
    },
  });
  if (!signup.ok()) throw new Error(`Signup falhou: ${await signup.text()}`);
  const { token, user } = await signup.json();

  const instructor = await api(request, token, 'POST', '/api/students', {
    name: `Professor E2E ${ts}`,
    email: `prof-matricula-${ts}@test.com`,
    password: 'Senha@123',
    role: 'PROFESSOR',
  });

  const classType = await api(request, token, 'POST', '/api/classes/class-types', {
    name: `BJJ E2E ${ts}`,
    duration: 60,
    maxCapacity: 20,
  });

  const klass = await api(request, token, 'POST', '/api/classes', {
    classTypeId: classType.id,
    instructorId: instructor.id,
    dayOfWeek: new Date().getDay(),
    startTime: '21:15',
    endTime: '22:15',
  });

  const plan = await api(request, token, 'POST', '/api/membership-plans', {
    name: `Plano E2E ${ts}`,
    price: 15000,
    duration: 30,
  });

  const student = await api(request, token, 'POST', '/api/students', {
    name: `Aluno Matricula ${ts}`,
    email: `aluno-matricula-${ts}@test.com`,
    password: 'Senha@123',
  });

  return {
    token,
    user,
    classId: klass.id,
    studentId: student.id,
    studentName: student.name,
    planName: plan.name,
  };
}

test.describe('5. Matrícula em turma — fluxo completo pela interface', () => {
  test('5.1 - Matricular, ver ocupação, registrar presença e remover', async ({ page, request }) => {
    const ctx = await setupAcademy(request);

    // Autentica o browser com o token da academia recém-criada
    await page.addInitScript(([token, user]) => {
      localStorage.setItem('auth_token', token as string);
      localStorage.setItem('user', JSON.stringify(user));
    }, [ctx.token, ctx.user] as const);

    // ── Abrir a turma na Gestão de Aulas ──────────────────────────────────
    await page.goto('/dashboard/aulas');

    const occupancyBadge = page.getByTestId(`button-occupancy-${ctx.classId}`);
    await expect(occupancyBadge).toBeVisible();
    await expect(occupancyBadge).toContainText('0 alunos');
    await occupancyBadge.click();

    // ── Matricular o aluno ────────────────────────────────────────────────
    await expect(page.getByTestId('enrollments-empty')).toBeVisible();
    await expect(page.getByText('Nenhum aluno matriculado ainda').first()).toBeVisible();

    await page.getByTestId('button-pick-student').click();
    await page.getByTestId('input-search-student').fill(ctx.studentName);
    await page.getByTestId(`option-student-${ctx.studentId}`).click();

    await page.getByTestId('select-enrollment-plan').click();
    await page.getByRole('option', { name: ctx.planName }).click();

    await page.getByTestId('button-enroll-student').click();

    await expect(page.getByText('Aluno matriculado!').first()).toBeVisible();
    await expect(page.getByTestId(`enrollment-row-${ctx.studentId}`)).toBeVisible();

    // ── Ocupação atualiza (dialog e tabela) ───────────────────────────────
    await expect(page.getByTestId('badge-occupancy')).toContainText('1 aluno');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(`button-occupancy-${ctx.classId}`)).toContainText('1 aluno');

    // ── Registrar presença do aluno matriculado ───────────────────────────
    await page.goto(`/dashboard/presenca/${ctx.classId}`);
    await expect(page.getByTestId(`attendance-row-${ctx.studentId}`)).toBeVisible();

    await page.getByTestId(`select-status-${ctx.studentId}`).click();
    await page.getByRole('option', { name: 'Presente' }).click();
    await page.getByTestId(`button-save-${ctx.studentId}`).click();

    await expect(page.getByText('Presença registrada').first()).toBeVisible();

    // ── Remover a matrícula ───────────────────────────────────────────────
    await page.goto('/dashboard/aulas');
    await page.getByTestId(`button-occupancy-${ctx.classId}`).click();

    await page.getByTestId(`button-remove-enrollment-${ctx.studentId}`).click();
    await page.getByTestId('button-confirm-remove').click();

    await expect(page.getByText('Matrícula removida').first()).toBeVisible();
    await expect(page.getByTestId('enrollments-empty')).toBeVisible();
    await expect(page.getByTestId('badge-occupancy')).toContainText('0 alunos');

    // ── Limpeza (best-effort): desativa a turma criada ────────────────────
    await request.delete(`/api/classes/${ctx.classId}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    }).catch(() => {});
  });
});
