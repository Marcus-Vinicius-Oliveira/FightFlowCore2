# Auditoria Técnica — FightFlowCore2

**Data:** 03/07/2026 · **Escopo:** repositório completo (client, server, shared, tests, configs, dependências)

---

## 1. Visão geral da arquitetura

- **Stack:** React 18 + Vite 5 + Tailwind 3 + shadcn/Radix (client) · Express 4 + Drizzle ORM + PostgreSQL/Neon (server) · Zod compartilhado via `shared/schema.ts`.
- **Autenticação:** JWT Bearer (24h) com `jti` + blacklist (Redis opcional, fallback em memória), bcrypt custo 12, role/academyId sempre relidos do banco a cada request (`server/auth.ts`).
- **Multi-tenancy:** coluna `academy_id` em todas as entidades; cada rota confere posse do recurso (`entity.academyId !== req.user.academyId → 404`). Middleware `requireSameAcademy` injeta o `academyId` do usuário no body.
- **Domínio:** users (SUPER_ADMIN / ADMIN_ACADEMIA / PROFESSOR / ALUNO), academies, membership_plans (mensalidade), classes + class_types (turmas/modalidades), enrollments (matrícula em turma), attendance (presença), payments, planos/assinaturas (SaaS), sistema de graduação por modalidade (systems/ranks/history).
- **Rotas:** 10 routers em `server/routes/`, montados em `server/routes.ts`. Job horário `markOverduePayments`.
- **Testes:** 2 arquivos Vitest (10 testes unitários: auth + sanitize) — **passando**. 4 specs Playwright E2E (multi-tenancy, RBAC, fluxos, performance) — exigem servidor + banco ativos, não executados nesta auditoria.
- **Baseline typecheck:** `tsc` com **3 erros** (2 em `StudentManagement.tsx` — WIP não commitado; 1 em `schedule-pdf.service.ts` por falta de `target` no tsconfig).
- **Estado do working tree:** havia trabalho finalizado de sessões anteriores não commitado (fluxo de auth/redirect no client, validação de academia órfã no server, `seeds-full-restore.ts`). Commitado como baseline no início da Fase 3.

---

## 2. Diagnóstico por severidade

### 🔴 Crítico

| # | Área | Achado |
|---|------|--------|
| C1 | Corretude / Presença | **Taxa de presença do dashboard sempre 0%** com dados reais: o POST de presença grava apenas `status` ('presente'/'falta'/'justificado'), mas `dashboard.routes.ts` conta `attendance.present = true` — campo legado que só os seeds preenchem. |
| C2 | Corretude / Matrícula | **Não existe rota para matricular aluno em turma.** `storage.createEnrollment` é código morto. Como o POST de presença exige matrícula ativa (`getEnrollmentByStudentAndClass`), o fluxo de check-in é impossível fora dos seeds. `maxCapacity` (limite de vagas) nunca é aplicado. |
| C3 | Dependências | `npm audit`: **22 vulnerabilidades (11 high)**. Diretas: **drizzle-orm < 0.45.2 (HIGH — SQL injection GHSA-gpj5-g38j-94v9)**, **ws 8.18 (HIGH — memory disclosure/DoS, usado pelo driver Neon)**, express/body-parser/qs (moderate), esbuild/rollup/vite/babel/yaml (dev-time). |

### 🟠 Alto

| # | Área | Achado |
|---|------|--------|
| A1 | Segurança / XSS server-side | `schedule-pdf.service.ts` interpola `academyName`, `typeName` e `instructorName` **sem escape** no HTML renderizado por Chromium headless no servidor — injeção de HTML/script no contexto do renderer. |
| A2 | Financeiro / Perda de dados | Modal "Marcar como Pago" (`FinancialControl.tsx`): **"Meio de Pagamento" é obrigatório mas nunca é enviado ao servidor** (não há campo no schema); "Valor Pago" é editável mas também não é persistido. |
| A3 | Financeiro / KPI errado | Card "Receita do Mês" soma **todos os pagamentos pagos de qualquer período**, não do mês corrente (o endpoint `/api/dashboard/stats` calcula certo; a página financeira não). |
| A4 | Infra / Rate limit | `express-rate-limit` sem `app.set('trust proxy')`: em produção atrás de proxy (Replit/NGINX), todos os clientes compartilham o mesmo IP — o limite global de 500 req/15min pode derrubar todos os usuários de uma vez, e o limiter de login fica ineficaz por IP real. |

### 🟡 Médio

| # | Área | Achado |
|---|------|--------|
| M1 | Domínio / Turmas | Nenhuma validação de **conflito de horário** (mesmo professor em duas turmas sobrepostas no mesmo dia) ao criar/editar turma. |
| M2 | Domínio / Turmas | `startTime`/`endTime` são strings livres — sem validação de formato `HH:MM` nem `endTime > startTime`. Ordenação e agrupamento dependem do formato. |
| M3 | Financeiro / Inadimplência | `markOverduePayments` usa `dueDate < now()`: pagamento com vencimento hoje já vira "atrasado" durante o próprio dia (convenção BR: vence ao fim do dia do vencimento). |
| M4 | Financeiro / Consistência | PATCH `/api/payments/:id` aceita `status: 'paid'` sem `paidDate` — pagamento pago sem data de pagamento (quebra o KPI de receita mensal, que agrupa por `paid_date`). |
| M5 | Arquitetura / Cache | Duas convenções de queryKey no client: páginas novas usam `['/api/...']` (queryFn default), `FinancialControl` usa `['payments']`+`apiClient` — invalidação entre páginas não funciona (ex.: marcar pago não atualiza o chip "Inadimplentes" da lista de alunos). |
| M6 | Qualidade / Typecheck | 3 erros de `tsc`: generics do `useQuery` com `select` em `StudentManagement.tsx:513`; `tsconfig.json` sem `target` (default ES5) quebra spread de string em `schedule-pdf.service.ts:32`. |
| M7 | Código morto | `client/src/components/examples/` (8 arquivos), `client/src/components/StudentManagement.tsx` (871 linhas, não importado), `storage.createEnrollment` sem rota (resolvido por C2). |
| M8 | Performance | Client nunca usa a paginação que o servidor oferece: `/api/students` e `/api/payments` carregam listas completas. Aceitável < 500 registros; ruim para academias grandes. |
| M9 | UX / i18n | Mensagens de erro do servidor em inglês chegam ao usuário via toast: "Internal server error", "Access token required", "User not found or inactive", "Insufficient permissions". |
| M10 | Dependências / Build | `@playwright/test` em `dependencies` (deveria ser devDependency); `playwright` runtime é necessário em produção só pelo gerador de PDF. |
| M11 | Testes | Zero cobertura das regras de negócio críticas: inadimplência (job), limite de alunos por plano, conflito de horários, cálculo de presença, isolamento multi-tenant em nível unitário. E2E existem mas dependem de ambiente. |

### 🟢 Baixo

| # | Área | Achado |
|---|------|--------|
| B1 | Segurança | Senha mínima de 6 caracteres (recomendado ≥ 8 com composição). Token em `localStorage` (exposto a XSS; mitigado pelo React escapar por padrão + helmet CSP em prod). |
| B2 | Segurança | Signup permite `role: 'ALUNO'`/`'PROFESSOR'` criando academia própria — sem impacto cross-tenant, mas semanticamente estranho (aluno "dono" de academia sem admin). |
| B3 | UX | Botão "Ver Detalhes" em pagamentos pagos não faz nada (sem `onClick`). Página financeira sem estado de loading. |
| B4 | Domínio | `getAttendanceByClassAndDate` usa `lt(endOfDay 23:59:59.999)` — exclui o último milissegundo do dia (inofensivo na prática). |
| B5 | Índices | Falta índice composto `payments(status, due_date)` para o job de inadimplência e `payments(academy_id, due_date)` para a listagem ordenada. Volumes atuais não sofrem; custo de adicionar é zero. |
| B6 | Segurança OK (registro) | Pontos auditados e **sem problema**: secrets fora do git (`.env` ignorado), SQL sempre parametrizado, sanitização de password nos responses, CSRF não aplicável (Bearer token), enumeração de usuário mitigada no login, RBAC consistente, super-admin isolado. |

---

## 3. Plano de execução priorizado (Fase 2)

Ordenação por impacto × esforço. Regras: teste antes de mexer em regra de negócio crítica; suíte + typecheck após cada mudança de dependência; commits atômicos em português.

### Etapa 0 — Baseline
- [ ] Commitar WIP pré-existente de sessões anteriores (auth/redirect client, validação de academia órfã, seeds-restore)
- [ ] Corrigir os 3 erros de typecheck (M6): generics do `useQuery` + `target` no tsconfig

### Etapa 1 — Segurança e dependências (C3, A1, A4)
- [ ] `npm audit fix` (ws, express/qs, babel, rollup, yaml, brace-expansion) → rodar suíte + tsc
- [ ] Upgrade `drizzle-orm` → 0.45.x e `drizzle-kit` → 0.31.x (SQLi high) → rodar suíte + tsc
- [ ] Escape de HTML no `schedule-pdf.service.ts`
- [ ] `trust proxy` em produção + `@playwright/test` para devDependencies (M10)

### Etapa 2 — Regras de negócio críticas (C1, C2, M1–M4)
- [ ] Presença: gravar `present` derivado de `status` na rota + dashboard contar por `status = 'presente'` (teste primeiro)
- [ ] Rotas de matrícula em turma: `POST/DELETE /api/classes/:classId/enrollments` com checagem de vaga (`maxCapacity`), duplicidade e tenant (teste da lógica de capacidade primeiro)
- [ ] Conflito de horário do professor ao criar/editar turma (helper puro `timesOverlap` — teste primeiro)
- [ ] Validação `HH:MM` + `endTime > startTime` (Zod)
- [ ] Job de inadimplência: cutoff = início do dia corrente (teste primeiro)
- [ ] PATCH payments: `status: 'paid'` sem `paidDate` → default `now()`; nova coluna `payment_method`
- [ ] FinancialControl: enviar `paymentMethod` + valor editado; "Receita do Mês" filtrada pelo mês corrente

### Etapa 3 — Qualidade, performance e UX (M5, M7–M9, B3, B5)
- [ ] Unificar queryKeys do FinancialControl no padrão `['/api/...']`
- [ ] Remover código morto (`components/examples/`, `components/StudentManagement.tsx`)
- [ ] Índices compostos em `payments` (schema + instrução de migração)
- [ ] Mensagens de erro do servidor em pt-BR
- [ ] "Ver Detalhes" funcional + loading state na página financeira

### Fora de escopo desta rodada (recomendações futuras — ver §5)
UI completa de matrícula em turmas, geração automática de mensalidades recorrentes, paginação no client, refresh tokens, senha mínima 8, RLS no Postgres.

---

*(§4 Execução e §5 Próximos passos são preenchidos na Fase 4.)*
