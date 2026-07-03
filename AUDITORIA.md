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
- [x] Commitar WIP pré-existente de sessões anteriores (auth/redirect client, validação de academia órfã, seeds-restore) — `034286e`
- [x] Corrigir os 3 erros de typecheck (M6): generics do `useQuery` + `target` no tsconfig — `b4dc7bf`

### Etapa 1 — Segurança e dependências (C3, A1, A4)
- [x] `npm audit fix` (ws, express/qs, babel, rollup, yaml, brace-expansion) → suíte + tsc verdes — `4f64196`
- [x] Upgrade `drizzle-orm` → 0.45.2 e `drizzle-kit` → 0.31.10 (SQLi high) — `4f64196`
- [x] Upgrade `vite` 5 → 7 + `@vitejs/plugin-react` 5 (path traversal high do dev server) — `4f64196`
- [x] Escape de HTML no `schedule-pdf.service.ts` — `fd88a29`
- [x] `trust proxy` em produção + `@playwright/test` para devDependencies (M10) — `fd88a29`

### Etapa 2 — Regras de negócio críticas (C1, C2, M1–M4)
- [x] Presença: `present` derivado de `status` na rota + dashboard conta por `status = 'presente'` (teste primeiro) — `705d5a0`
- [x] Rotas de matrícula em turma com vaga/duplicidade/tenant (teste de capacidade primeiro) — `e60f7f7`
- [x] Conflito de horário do professor ao criar/editar turma (helpers puros testados) — `7bcc7bc`
- [x] Validação `HH:MM` + `endTime > startTime` (Zod) — `7bcc7bc`
- [x] Job de inadimplência: cutoff = início do dia corrente (teste primeiro) — `2cdb760`
- [x] PATCH payments: `paid` sem `paidDate` → `now()`; coluna `payment_method`; índices compostos — `2cdb760`
- [x] FinancialControl: envia `paymentMethod` + valor editado; "Receita do Mês" do mês corrente — `0b89843`

### Etapa 3 — Qualidade, performance e UX (M5, M7–M9, B3, B5)
- [x] queryKeys do FinancialControl unificadas no padrão `['/api/...']` — `0b89843`
- [x] Código morto removido (`components/examples/`, `components/StudentManagement.tsx`, −964 linhas) — `d0ec818`
- [x] Índices compostos em `payments` — `2cdb760` (migração já aplicada, ver §4.2)
- [x] Mensagens de erro do servidor em pt-BR — `1033d68`
- [x] "Ver Detalhes" funcional + loading state na página financeira — `0b89843`

---

## 4. Execução — o que foi feito (Fase 4)

### 4.1 Resumo executivo

**11 commits atômicos**, todos com suíte de testes e typecheck verdes. Resultado:

- **Vulnerabilidades: 22 → 5** (era 11 high; as 5 restantes são todas de ferramentas de desenvolvimento — vite aninhado do vitest e cadeia `@esbuild-kit` do drizzle-kit — **sem nenhuma exposição em produção**). As 3 diretas apontadas pelo relatório de dependências (drizzle-orm SQLi, ws, express/qs) estão resolvidas.
- **3 bugs críticos de domínio corrigidos**: taxa de presença que nunca saía de 0%, impossibilidade de matricular aluno em turma (fluxo de presença quebrado) e KPIs financeiros errados/perdendo dados.
- **Testes: 10 → 33** (helpers de presença, capacidade de turma, sobreposição de horários e corte de inadimplência — todos escritos antes do código, conforme regra).
- **Typecheck: 3 erros → 0**. Código morto: −964 linhas.
- **Smoke test de runtime**: servidor no ar, login real, `/api/payments` com a nova coluna, `/api/dashboard/stats` e a nova rota de matrículas respondendo corretamente.

### 4.2 Migração de banco (já aplicada no banco de desenvolvimento)

`npm run db:push` foi executado com sucesso (mudanças **aditivas**): coluna `payments.payment_method` (nullable) e índices `payments_status_due_date_idx` e `payments_academy_due_date_idx`. Em outros ambientes, rode `npm run db:push` após o deploy.

**Rollback** (se necessário):
```sql
ALTER TABLE payments DROP COLUMN payment_method;
DROP INDEX payments_status_due_date_idx;
DROP INDEX payments_academy_due_date_idx;
```

### 4.3 Mudanças de comportamento visível (intencionais)

| Mudança | Antes | Depois |
|---|---|---|
| Conflito de agenda | Professor podia ter 2 turmas sobrepostas | POST/PATCH de turma retorna 409 com mensagem clara |
| Inadimplência | Mensalidade virava "atrasada" no próprio dia do vencimento | Só após o fim do dia do vencimento |
| Marcar como pago | Meio de pagamento e valor editado eram descartados | Persistidos; `paidDate` default = hoje |
| Receita do Mês (pág. financeira) | Somava todos os pagos de sempre | Apenas o mês corrente |
| Ver Detalhes | Botão sem ação | Dialog com dados completos do pagamento |
| Erros da API | Parte em inglês | Tudo em pt-BR |

### 4.4 Itens deixados como recomendação (com justificativa)

| Item | Justificativa |
|---|---|
| ~~**UI de matrícula em turmas**~~ | ✅ **Entregue em 03/07/2026** — ver §6. |
| Vulnerabilidades dev-time restantes (5) | Exigem vitest/drizzle-kit majors futuros; zero exposição em produção. |
| Paginação no client | Servidor já suporta `limit/offset`; client carrega listas completas — aceitável no volume atual (58 alunos), vira prioridade acima de ~500 registros. |
| Code-splitting do bundle (1,4 MB) | `manualChunks`/`React.lazy` para recharts e páginas do superadmin; ganho relevante em mobile. |
| Senha mínima 8 caracteres + política | Mudança de comportamento em signup — decidir junto com política de recuperação de senha. |
| Refresh tokens / expiração menor | Token de 24h em localStorage é o design atual; migrar para refresh + cookie httpOnly é projeto próprio. |
| Geração automática de mensalidades | Ver §5 — é a melhoria de produto de maior valor. |

## 5. Próximos passos sugeridos (produto)

1. **Geração automática de mensalidades recorrentes** — job que cria o próximo pagamento ao fim de cada ciclo do plano (`duration`), eliminando o cadastro manual um a um. É o maior atrito atual do financeiro.
2. **Lembretes automáticos de vencimento** — WhatsApp/e-mail D-3 e D+1 usando o telefone já cadastrado; reduz inadimplência sem esforço do gestor.
3. **Relatório de retenção/churn** — alunos sem presença há 14/30 dias (dados já existem em `attendance`); alerta proativo é o que mais salva receita de academia.
4. **Ranking de assiduidade** — top alunos por presenças no mês, exibível no mural/portal; gamificação barata com dados existentes.
5. **Check-in pelo aluno (QR code)** — o portal do aluno já existe; um QR na recepção tiraria o professor do papel de apontador.
6. **Sugestão de graduação** — cruzar presenças acumuladas com tempo na faixa atual para sugerir candidatos a promoção por modalidade.
7. **Dashboard de ocupação de turmas** — com matrículas agora funcionais, mostrar taxa de ocupação por turma (`enrollments`/`maxCapacity`) orienta abertura/fechamento de horários. *(Parcialmente entregue em §6 — a ocupação já aparece por turma na Gestão de Aulas.)*

---

## 6. Entrega — UI de matrícula em turmas (03/07/2026)

Sessão dedicada a construir a interface sobre a API de matrículas criada na auditoria (7 commits, `b954f11`..`d49f4b0`). O check-in de presença agora funciona de ponta a ponta pela interface, sem tocar em API.

**Onde ficou (decisão de navegação):**

- **Gestão de Aulas**: nova coluna **Ocupação** ("14/20 vagas", vermelha e clicável quando lotada; contagem simples quando a modalidade não tem limite) + ação **Matrículas** no menu de cada turma. Ambas abrem o dialog de gestão de matrículas — mesmo padrão de dialogs da própria página.
- **Ficha do aluno** (`StudentDetailDialog`): nova seção **Turmas** com as turmas do aluno (dias, horário, professor), matrícula em nova turma (turmas lotadas aparecem desabilitadas com aviso) e remoção com confirmação.

**Semântica de grupo:** uma "turma" na UI é um grupo de registros no banco (um por dia da semana) e o check-in usa o id do registro do dia. Matricular pela UI matricula em **todos os registros do grupo** (mesmo padrão do delete em lote pré-existente); a ocupação conta alunos distintos no grupo (`enrolledCount` calculado no servidor em 1 query com join, sem N+1).

**Comportamentos cobertos:** busca na lista de matriculados; combobox de aluno que exclui os já matriculados; seleção de plano (exigida pela API); erros 409 da API ("turma lotada", "já matriculado") exibidos como mensagem limpa em pt-BR no toast (o `queryClient` agora extrai o campo `error` do JSON em vez de mostrar o corpo bruto — melhoria global); skeleton de loading; empty states orientados; erro com "Tentar novamente"; invalidação por prefixo `['/api/classes']` atualiza lista de turmas, matrículas e presença sem reload; mobile-first validado com screenshots em viewport 375px.

**Endpoints adicionados (aditivos — a API de enrollments não foi alterada):** `enrolledCount` no `GET /api/classes` agrupado e `GET /api/students/:id/enrollments` (turmas do aluno, com isolamento por academia).

**Verificação:** typecheck limpo; **50 testes Vitest** (17 novos para a lógica pura de grupo/ocupação); **e2e Playwright novo** (`05-class-enrollments.spec.ts`) cobrindo o fluxo feliz completo — abrir turma → matricular → ocupação 0/20→1/20 no dialog e na tabela → registrar presença do aluno → remover matrícula → ocupação volta a 0/20 — passando em 6,6s; build de produção OK; smoke visual mobile do dialog e da listagem.

---

## 7. Seeds de desenvolvimento — fluxo sem duplicados (03/07/2026)

O teste manual revelou alunos "duplicados" na academia demo: dois seeds com elencos diferentes (`seeds-full-restore.ts` → e-mails `@ffc.demo`; `seeds-demo.ts`/`seeds-reset-alunos.ts` → `@demo.com`) haviam rodado na mesma academia `anjo`, empilhando 82 alunos com quase-clones ("João Pires" / "João Victor Pires"). Correções:

- **Guarda anti-empilhamento**: `seed:demo` aborta se a academia já tem alunos `@ffc.demo`, e `seed:restore` aborta se já tem `@demo.com` — rodar dois seeds na mesma base não duplica mais alunos. Cada seed continua individualmente idempotente (pula alunos existentes por e-mail).
- **`seed:reset-alunos` corrigido**: passou a apagar também `enrollments` (matrículas em turma — tabela criada depois do script), que causava violação de FK.
- **Novos comandos** (exclusivos de desenvolvimento; `seed:demo:clean` aborta com `NODE_ENV=production`):

```bash
npm run seed:demo:clean   # remove todos os alunos demo (@ffc.demo e @demo.com) da academia 'anjo' e seus registros
npm run seed:demo:reset   # limpa e repovoa do zero via seed:restore (elenco canônico: 28 alunos @ffc.demo)
```

O banco de desenvolvimento foi limpo com `seed:demo:reset` em 03/07/2026 — a academia `anjo` ficou com o elenco único de 28 alunos. Professores e admin são preservados na limpeza (turmas os referenciam).

**Notas:** o Playwright 1.61 exige `npx playwright install chromium` após o upgrade de dependências da auditoria. O limitador de signup (5/hora por IP) restringe execuções repetidas dos e2e que criam academias — em CI, considerar variável de ambiente para relaxá-lo. A tabela de Gestão de Aulas em telas pequenas usa o scroll horizontal interno padrão (comportamento pré-existente); uma visão em cards para mobile fica como melhoria futura.
