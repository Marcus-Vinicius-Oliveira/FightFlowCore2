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

---

## 8. Entrega — Mensalidades recorrentes + lembretes de vencimento (03/07/2026)

Motor de cobrança recorrente aprovado com as seguintes regras de negócio (decididas com o fundador): geração na **virada do mês** para todos os alunos ativos (com catch-up no boot), **dia de vencimento fixo por academia** (default 5, configurável 1–28), **valor do plano com desconto individual opcional** por aluno, atraso continua sendo apenas marcação (`markOverduePayments`, sem multa/bloqueio nesta fase), **lembrete por e-mail D-3** (antecedência configurável).

**Como funciona:**

- `server/jobs/recurringBilling.ts` roda no boot e a cada hora (mesmo padrão do job de inadimplência). Gera a mensalidade `pending` do mês para cada aluno ativo que ainda não a tem — **idempotente**: a existência de qualquer pagamento com vencimento no mês bloqueia nova geração; rodar N vezes não duplica.
- Plano do aluno: matrícula ativa em turma mais recente; na falta (bases anteriores à UI de matrícula), o plano da última mensalidade. Aluno sem nenhuma referência de plano não é cobrado automaticamente. Aluno criado depois do vencimento do mês é cobrado a partir do mês seguinte.
- Valor: `users.custom_monthly_amount` (centavos, editável na ficha do aluno como "Mensalidade com Desconto") prevalece sobre `membership_plans.price`; zero é válido (bolsista 100%).
- Lembrete: mensalidades pendentes vencendo em até `PAYMENT_REMINDER_DAYS_BEFORE` dias (default 3) recebem e-mail em pt-BR (1 por mensalidade, controlado por `payments.reminder_sent_at`). Sem `SMTP_HOST` configurado (ver `.env.example`), o lembrete é apenas logado — e ainda assim marcado, para não repetir a cada hora; mensalidades já vencidas não recebem lembrete.
- Configuração do dia de vencimento: botão "Vencimento: dia N" no Controle Financeiro (`GET/PATCH /api/academy/billing-settings`).
- Dependência adicionada: `nodemailer` (padrão de mercado para SMTP, sem dependências transitivas).

**Migração (aplicada no banco de desenvolvimento via `npm run db:push`; rode após o deploy em outros ambientes).** Mudanças aditivas: `academies.payment_due_day` (int, not null, default 5), `users.custom_monthly_amount` (int, nullable), `payments.reminder_sent_at` (timestamp, nullable).

**Rollback** (se necessário):
```sql
ALTER TABLE academies DROP COLUMN payment_due_day;
ALTER TABLE users DROP COLUMN custom_monthly_amount;
ALTER TABLE payments DROP COLUMN reminder_sent_at;
```

**Verificação:** 27 testes novos em `server/__tests__/recurring.test.ts` (geração no período correto, idempotência, valor plano/desconto, janela de lembrete, texto do e-mail) + smoke real contra o banco de dev: geração de agosto/2026 criou 29 mensalidades (28 demo + 1 aluno de academia e2e com matrícula ativa — comportamento correto), segunda rodada criou 0, vencimentos no dia 5, inserções desfeitas ao final.

**Recomendações futuras:** lembrete por WhatsApp (Twilio/Z-API), multa/juros automáticos e bloqueio de check-in por inadimplência (regras já isoladas em `server/lib/recurring.ts`), limpeza periódica das academias e2e do banco de dev (os alunos delas entram na cobrança recorrente).

---

## 9. Suíte e2e — estado real e reativação (03/07/2026)

Ao rodar a suíte Playwright completa (nunca executada de ponta a ponta desde a reescrita da UI), constatou-se que os specs antigos estavam quebrados por drift, não por regressão:

- **Specs 01 (multi-tenancy) e 02 (RBAC) reativados** — eram API-only, mas o helper criava academia navegando pela UI extinta (`link-signup`) e usava rotas antigas (`/api/class-types` → hoje `/api/classes/class-types`; `POST /api/instructors` não existe — professores são criados via `POST /api/students` com role). Helper migrado para signup via API (mesmo padrão do spec 05) e expectativas alinhadas ao contrato atual (aluno não lê `/api/classes` — usa o portal; token inválido → 403, ausente → 401). **14 testes passando.**
- **Specs 03 (fluxos de UI) e 04 (performance) marcados como skip** com justificativa no código: referenciam dezenas de `data-testid` da UI original que não existem mais (`nav-alunos`, `tab-modalidades`, `metric-students`…). Reescrevê-los contra a UI atual é trabalho dedicado — fica como recomendação (15 testes skipped, 0 failing).
- **Rate limiters de login/signup agora são desativados fora de produção** (mesmo critério do limiter global) — sem isso, execuções repetidas dos e2e esbarravam no 429 de signup (5/hora/IP), a armadilha registrada no §6.

**Notas:** o Playwright 1.61 exige `npx playwright install chromium` após o upgrade de dependências da auditoria. A tabela de Gestão de Aulas em telas pequenas usa o scroll horizontal interno padrão (comportamento pré-existente); uma visão em cards para mobile fica como melhoria futura.

---

## 10. Entrega — Responsável legal para aluno menor de idade (05/07/2026)

Cadastro de alunos passou a exigir **responsável legal (nome + telefone) quando o aluno é menor de 18 anos**, com parentesco opcional. A regra vive em um único lugar (`guardianRequirementError` em `shared/schema.ts`, junto com `calculateAge`/`isMinor`) e é aplicada nos três pontos: validação Zod do formulário, pré-checagem no dialog de edição e validação da API.

**Comportamento:**

- **Adicionar Aluno**: ao digitar uma data de nascimento de menor, aparece a seção "Responsável Legal" (nome e telefone obrigatórios, parentesco em select: Mãe/Pai/Avó-Avô/Tia-Tio/Tutor(a) legal/Outro). Para adulto a seção não aparece e nada é persistido. Selects nativos, pelo mesmo racional mobile dos checkboxes do dialog.
- **Ficha do aluno** (`StudentDetailDialog`): badge "Menor de idade" ao lado da data de nascimento; seção Responsável Legal em visualização (nome, parentesco, telefone) e edição; aviso âmbar quando um menor legado não tem responsável cadastrado. A pré-checagem no salvar usa a mesma função do servidor (mensagem idêntica, sem round-trip).
- **API** (`POST/PATCH /api/students`): menor sem nome/telefone do responsável → 400 com mensagem em pt-BR. No PATCH a regra valida o **estado resultante** (payload + banco), mas **só dispara quando a data de nascimento muda ou o payload mexe no responsável** — cadastros antigos de menores sem responsável continuam editáveis em campos não relacionados (ativar/desativar, faixa etc.), e o `StudentForm` legado de StudentManagement não quebra. `null` limpa o responsável (aceito apenas para maior de idade). Sem data de nascimento cadastrada, a regra não se aplica (idade desconhecida ≠ menor).
- `GET /api/students` (lista) agora inclui os três campos do responsável.

**Migração (aplicada no banco de desenvolvimento via `npm run db:push`; rode após o deploy em outros ambientes).** Aditiva: `users.guardian_name`, `users.guardian_phone`, `users.guardian_relationship` (text, nullable).

**Rollback:**

```sql
ALTER TABLE users DROP COLUMN guardian_name, DROP COLUMN guardian_phone, DROP COLUMN guardian_relationship;
```

**Verificação:** 15 testes novos (`server/__tests__/guardian.test.ts` — fronteira dos 18 anos no dia do aniversário, datas string/Date/ausente/inválida, mensagens exatas); typecheck limpo; suíte completa 96/96; build de produção OK. **Nota colateral:** `vitest.config.ts` ganhou o alias `@shared` (o import de valor em `students.routes.ts` expôs que o alias só existia no Vite/tsconfig — os 3 testes de sanitize que dependiam dele deixaram de ser silenciosamente pulados e passam).

**Recomendações futuras:** termo de autorização de imagem/participação assinado pelo responsável (upload na ficha), e-mail do responsável como destinatário dos lembretes de mensalidade quando o aluno é menor, e migrar o `StudentForm` legado de StudentManagement para o `StudentDetailDialog` (dois caminhos de edição hoje).

---

## 11. Fix — sessão expirada deixava o app em estado zumbi (05/07/2026)

**Sintoma:** dashboard com "Erro ao carregar informações da academia" e todas as métricas zeradas, mas usuário aparentemente logado (saudação vinda do cache do localStorage).

**Causa raiz:** o middleware de auth responde **403** para token expirado/corrompido e **401** para token ausente (contrato assertado nos e2e do §9). As duas camadas HTTP do client (`queryClient.ts` e `api.ts`) só deslogavam em 401 — com o JWT vencido (24h), toda query falhava com 403 e o app ficava "logado" indefinidamente na tela de erro.

**Fix (client only, contrato da API intacto):** o 403 cuja mensagem é exatamente a do middleware (`Token inválido ou expirado`, exportada como `INVALID_TOKEN_ERROR` em `queryClient.ts`) agora dispara o mesmo fluxo do 401 — limpa `auth_token`/`user`, emite `auth:unauthorized` (toast "Sessão Expirada" + volta ao login). Os demais 403 (permissão, multi-tenancy, limite de plano) seguem virando toast de erro normal, sem deslogar.

**Verificação:** typecheck + 96/96 testes; smoke headless (Chromium/Playwright) contra o dev server real — token inválido no localStorage + `/dashboard` → sessão limpa, toast exibido, sem tela de erro.

---

## 12. Fix — inadimplência no Financeiro: contagem e aviso de dívida acumulada (05/07/2026)

Investigação a partir de um falso bug relatado ("marquei como pago e o aluno continua inadimplente na lista de Alunos"): o dado estava certo — o aluno tinha **outra** mensalidade em atraso de mês anterior. A confusão vinha de dois problemas reais no Controle Financeiro:

1. **Card "Inadimplentes (Nº de alunos)" contava mensalidades, não alunos** — mostrava 5 (mensalidades atrasadas) enquanto a lista de Alunos filtrava 3 (alunos distintos). Corrigido para `Set` de `studentId` sobre os pagamentos `overdue`; os dois números agora batem.
2. **Registrar pagamento não avisava sobre dívida acumulada** — o gestor quitava a mensalidade do mês e assumia que o aluno saía da inadimplência. O toast de sucesso agora alerta quando o aluno ainda tem outras mensalidades em atraso, com os meses: "Atenção: Fulano ainda tem 1 mensalidade em atraso (junho de 2026)."

**Verificação:** typecheck + 96/96; headless (read-only) contra o dev server — card mostra 3 com os dados atuais (5 mensalidades atrasadas / 3 alunos).

3. **Badge de dívida acumulada na tabela** *(entregue na sequência)* — a coluna Aluno mostra badge vermelho "N em atraso" ao lado do nome. Regra anti-ruído: o badge só aparece quando acrescenta informação além da própria linha — aluno com 2+ atrasos (qualquer linha dele), ou 1 atraso visto de uma linha não atrasada (ex.: a mensalidade paga do mês quando a do mês anterior segue aberta); na única linha atrasada do aluno, a coluna Status já comunica. Verificado em headless conferindo todas as 386 linhas da tabela contra a regra computada da API (13 linhas com badge, 0 divergências).

**Refinamentos de UX após revisão visual (mesma data):**

- **Badge em outline** (borda/texto vermelhos, fundo transparente, ícone ⚠) — no filtro "Atrasados" o badge sólido competia com o chip de Status na mesma linha; o outline estabelece hierarquia (Status = estado da linha, badge = contexto do aluno).
- **Tooltip com meses + valor total** no badge (ex.: "junho de 2026, julho de 2026 — R$ 240,00 no total") — a pergunta do gestor na cobrança é "quanto", não só "quantas".
- **Filtro "Atrasados" ordena vencimento mais antigo primeiro** (só nesse filtro) — o "Marcar como Pago" mais à mão passa a quitar a dívida na ordem certa; pagar só o mês recente escondia o débito anterior (origem da confusão que motivou o §12).

Verificação headless dos três: ordem crescente confirmada, badge outline com ícone, tooltip com meses e total; typecheck + 96/96.

**Escala (200+ alunos, dezenas de inadimplentes) — mesma data:**

- **Filtro "Atrasados" virou visão agrupada por devedor**: uma linha por aluno (badge de contagem, total devido em vermelho, "em atraso desde"), expansível para as mensalidades — mais antiga primeiro, cada uma com seu "Marcar como Pago". Motivo: a tabela plana ordenada por vencimento intercalava os meses de alunos diferentes (40 devedores × 2-3 meses ≈ 100 linhas embaralhadas). Devedores ordenados pela dívida mais antiga. Os filtros "Todos"/"Pagos"/"Próximos" mantêm a tabela plana por mensalidade (formato certo para histórico).
- **Busca "Buscar aluno..." na linha de filtros** — filtra a tabela em todos os filtros, sem acento/caixa (`NFD` + `\p{M}`); resolve o caso "aluno no balcão querendo pagar" sem rolagem.
- Empty state do Atrasados diferenciado: "todos em dia 🎉" vs. "nenhum inadimplente para a busca".

Verificação headless: 2 devedores agrupados (linha com total R$ 240,00 e desde 05/06/2026), expansão com 2 mensalidades em ordem e botões de pagamento, busca "patricia" → só Patricia Luz no Atrasados e no Todos; typecheck + 96/96; screenshot conferido.

---

## 13. Fix — card "Instrutores" do dashboard não refletia cadastro (05/07/2026)

**Sintoma:** cadastrar instrutor atualizava a lista (3 de 3), mas o card do Painel seguia mostrando 2.

**Causa raiz:** cache do client, não contagem no banco. O card é alimentado por `/api/dashboard/info`, mas as mutations de `InstructorManagement.tsx` só invalidavam `/api/instructors`, `/api/users` e `/api/students`. Com `staleTime` de 5 min e `refetchOnWindowFocus: false`, voltar ao Painel servia o valor velho. O helper `invalidateAfterInstructorChange` (cache-helpers.ts) existia exatamente para isso — a tela de alunos usava o equivalente; a de instrutores, não.

**Fix:** as 5 mutations de instrutor (criar, editar, desativar, reativar, excluir permanentemente) passam a chamar o helper. Verificação: typecheck + 96/96. — `da81537`

---

## 14. Entrega — Graduações por Modalidade como ferramenta de gestão (05/07/2026)

Reforma do card do dashboard em 5 prioridades decididas com o fundador, transformando a "lista de barras" em instrumento de decisão. — `7ec7387`

- **Barra honesta:** largura proporcional ao **total de graduados da modalidade** (antes: relativa ao máximo da lista — 1 aluno preenchia meia tela). Rótulo "N alunos · X%", piso visual de 3%.
- **Click-through:** cada faixa navega para a lista de Alunos já filtrada (`/dashboard/alunos?modalidade=<classTypeId>&graduacao=<rankId>`); o `StudentManagement` inicializa os filtros a partir da URL (deep-link, com as tags removíveis normais). O endpoint `/api/dashboard/charts` passou a incluir os IDs.
- **Visão-resumo:** barra 100% empilhada acima da lista (um segmento colorido por faixa, gap de 2px, tooltip nativo, `aria-label`); lista em 2 colunas no desktop (corta a altura ~pela metade).
- **Faixas zeradas visíveis:** a query partiu de `student_modality_ranks` para `graduation_systems`→`graduation_ranks` com LEFT JOIN — faixa sem aluno aparece apagada (informação de pipeline). Subtítulo com ocupação: "BJJ · 13 alunos graduados · 8 de 11 faixas". Linha tracejada **"Sem graduação registrada · N alunos"** ao final (matriculados ativos na modalidade sem rank — sinal de cadastro incompleto), clicável para a lista da modalidade.
- **Seletor:** tabs com contagem por modalidade no desktop (com overflow-x de segurança); no mobile, Select de largura total no padrão de filtro do app (label dinâmico no trigger, sem SelectValue). Auto-scroll ao trocar de modalidade estendido a todos os breakpoints (a restrição `< 1024px` assumia card sempre visível em desktop, premissa quebrada com o card no fim da página).

**Mudanças de comportamento intencionais:** modalidades com sistema de graduação e zero graduados agora aparecem nas abas (lista toda apagada); o clique em "Sem graduação registrada" leva à lista da modalidade inteira (a tela de Alunos ainda não tem filtro "sem graduação").

**Verificação:** typecheck + 96/96 a cada etapa. **Recomendações futuras:** opção "Sem graduação" no filtro de Graduação (deixa o link exato); contagem "graduados/matriculados" nas tabs (ex.: 13/15) se a linha de cadastro incompleto ganhar peso na operação.

---

## 15. Entrega — Controle de Pagamentos em cards no mobile (05/07/2026)

As duas tabelas do Financeiro (padrão de 7 colunas e agrupada de inadimplentes do §12) viviam num `overflow-x-auto` com `min-w-[640px]` — no celular o gestor arrastava para o lado e perdia justamente Status, Valor e o botão de ação. — `f094ecb`

- **Abaixo de 768px**, cada linha vira card empilhado com hierarquia de leitura: nome + badge de dívida + status no topo; plano/vencimento como linha secundária; valor em destaque com data de pagamento; ação em botão de largura total (alvo de toque adequado). "Ver Detalhes" quando pago, "Marcar como Pago" caso contrário — mesmos modais de sempre.
- **Visão Atrasados:** card por devedor (total em vermelho, "desde <data>", badge de contagem), expansível para as mensalidades com seus botões — reutiliza o estado `expandedStudents` do §12.
- Estados de loading/vazio com versão card; **desktop intacto** (`hidden md:block`); `data-testid` próprios nos cards (`card-payment-*`, `card-debtor-*`) para nunca duplicar IDs com a tabela oculta.

**Verificação:** typecheck + 96/96; validação visual em viewport estreito. **Pendência correlata (§9):** a tabela de Gestão de Aulas ainda usa scroll horizontal no mobile — candidata ao mesmo padrão de cards.

---

## 16. Fix — menu lateral recolhido vazava textos sobre o conteúdo (05/07/2026)

**Sintoma:** em desktop/tablet, recolher a sidebar deixava "Fight Club App" quebrado em coluna por cima do cabeçalho da página, iniciais dos itens de menu visíveis e "Sair da Conta" estourando o trilho.

**Causa raiz:** o sidebar usa o modo `collapsible="icon"` do shadcn (trilho de ~48px, estado exposto via `group-data-[collapsible=icon]`); os componentes base se ajustam, mas o conteúdo customizado do `AppSidebar` (logo com texto, bloco do usuário, botão sair, labels) não usava as variantes.

**Fix (só classes, expandido nada muda):** recolhido = logo centralizada sem texto; itens só com ícone (tooltips com o nome já existiam no `SidebarMenuButton`); avatar 32px centralizado sem nome/e-mail; "Sair" vira botão só de ícone. Verificação: typecheck limpo + conferência visual nos dois estados. — `3ccdf18`

---

## 17. Entrega — Desfazer pagamento marcado por engano (06/07/2026)

Lacuna apontada pelo fundador: "Marcar como Pago" era irreversível pela UI — um clique errado só se corrigia direto no banco. — `90529d2`

- **UI:** o modal "Ver Detalhes" (única ação disponível num pagamento pago) ganha o botão **"Desfazer pagamento"**, com AlertDialog de confirmação que nomeia aluno, valor e para qual status a mensalidade voltará — decisão que mexe na receita do mês não pode ser um clique só. O diálogo segura aberto até a API responder (Radix fecha no clique por padrão), para erro não passar despercebido.
- **Status de retorno:** recalculado no client com a mesma convenção do servidor (`overdueCutoff` — vencida só após o fim do dia do vencimento): `overdue` se o vencimento passou, senão `pending`. Helper `isOverdue` documenta o espelhamento.
- **Backend (`PATCH /api/payments/:id`):** reverter um pagamento `paid` limpa `paid_date` e `payment_method` automaticamente. Sem isso o registro revertido continuava exibindo "pago em ..." (o card mobile mostra a data quando existe) e, ao ser marcado como pago de novo, ressuscitava o meio de pagamento da operação desfeita. Os KPIs de receita já filtravam por `status = 'paid'`, então a reversão do status corrige receita do mês e gráfico de 6 meses sem mudança extra.

**Verificação:** typecheck + 96/96; **e2e Playwright contra instância isolada (porta 5001)** com fixtures temporárias no banco (`@verify.tmp`, removidas ao final): login → marcar atrasada como paga → desfazer pela UI → badge volta a "Atrasado", data "-", API confirma `{status: overdue, paidDate: null, paymentMethod: null}`. Probes: reverter pagamento não-pago é troca de status normal; re-marcar como pago após undo recebe `paidDate` novo sem dados fantasma. Receita de verificação persistida em `.claude/skills/verify/SKILL.md`.

**Bug pré-existente encontrado na verificação (não corrigido aqui):** datas date-only (`YYYY-MM-DD`) enviadas ao backend são parseadas como meia-noite UTC e exibidas com `toLocaleDateString` local (UTC-3) — pagamento registrado dia 06/07 aparece "pago em 05/07". Afeta a exibição de `paidDate`/`dueDate` em geral; candidato a fix dedicado.

---

## 18. Entrega — Relatórios do Financeiro: período, CSV e PDF (06/07/2026)

Necessidade do fundador: fechar o mês e prestar contas fora do app (contador, sócio), sem sair copiando linha por linha da tela.

- **Filtro de período:** novo `Select` que oferece só os meses que existem nos vencimentos (mais recente primeiro), no padrão de filtro validado do app (label dinâmico no `SelectTrigger`, borda `primary` quando ativo). Com um mês selecionado a tela conta uma história só: os KPIs viram competência daquele mês ("Receita de julho de 2026" = mensalidades do mês pagas; "A Receber de julho" = as em aberto do mês); sem período, mantêm o comportamento clássico (caixa do mês corrente + a receber total).
- **Exceção em Atrasados:** período não se aplica no filtro Atrasados — inadimplência é dívida acumulada, e recortar por mês esconderia a mensalidade antiga que originou o débito. Um aviso abaixo dos filtros explica isso quando os dois estão ativos.
- **Exportar CSV (Excel):** gera sobre o recorte atual (período + status + busca), com BOM e separador `;` para o Excel pt-BR abrir com acentuação e colunas corretas; valores com vírgula decimal. Nome do arquivo carrega o recorte (`financeiro-2026-07-pagos.csv`).
- **Imprimir / Salvar PDF:** relatório imprimível renderizado num `createPortal` direto no `<body>` (escapa dos contêineres com `overflow` do layout que cortariam a impressão na 1ª página); `@media print` em `index.css` esconde o app e mostra só ele. Inclui cabeçalho com academia/período/filtro, os 3 KPIs, um **fechamento por meio de pagamento** (dado que não existia em nenhuma outra tela) e a tabela de mensalidades com total do recorte.
- **Backend:** nenhuma mudança — `paymentMethod` já vinha na API; tudo é derivado no client a partir dos dados já carregados.

**Verificação:** typecheck limpo + **96/96 Vitest**; **e2e Playwright contra instância isolada (porta 5001)** com fixtures temporárias no banco (`@verify.tmp`: Alfa em dia com maio/junho/julho pagos em PIX/Dinheiro/PIX, Beta devedor de junho e julho — removidas ao final). Confirmado: KPIs sem período (R$150 / R$300), período maio (R$150 / R$0), período julho (R$150 / R$150); portal de impressão com título, "Fechamento por meio de pagamento" e "Mensalidades (2)"; CSV `financeiro-2026-07.csv` com BOM, `;` e linhas corretas (Beta Atrasado / Alfa Pago PIX); aviso de período+Atrasados visível. Sem erros de console novos (só um warning pré-existente de `forwardRef` no `Badge` dentro do Tooltip da tabela).

---

## 19. Fix — badge "em atraso" não aparece mais em mensalidade paga (06/07/2026)

Contradição apontada pelo fundador: uma linha com status "Pago" exibia, ao lado do nome, o badge vermelho "⚠ N em atraso" (dívida acumulada do aluno em outro mês). "Pago" + "em atraso" na mesma linha se contradizem à primeira vista, independentemente do texto do badge.

- **Fix:** o badge de dívida acumulada (`atrasosDoAluno`) ganhou o guard `status !== 'pago'` nos dois pontos onde é renderizado por linha — tabela desktop e cards mobile. A visão agrupada de Atrasados não muda (lá o contexto já é dívida).
- **A dívida do aluno segue visível** onde não há contradição: no filtro Atrasados (tela dedicada), na visão Todos pela própria linha atrasada (status vermelho) e nas linhas em aberto (pendente/próximo) de quem também deve outro mês. A consequência esperada é que, olhando só o filtro Pagos, a pendência de outro mês deixa de aparecer — coerente, já que "Pagos" é a visão do que foi quitado.

**Verificação:** typecheck limpo.

---

## 20. Fix — filtro "Dia da semana" da Gestão de Aulas cancelava o próprio clique (06/07/2026)

Encontrado numa análise de UX das telas de matrícula/aulas pedida pelo fundador. Cada linha do popover de dias era um `<div onClick={toggleFilterDay}>` com um `<Checkbox onCheckedChange={toggleFilterDay}>` dentro: clicar exatamente no quadradinho disparava os dois handlers (o do checkbox + o clique borbulhando pro div), alternando duas vezes e resultando em efeito líquido zero — parecia que o filtro não funcionava. Clicar no texto do dia funcionava (só o div disparava), o que tornava o bug intermitente e confuso.

- **Fix:** `<div onClick>` virou `<label>`, que encaminha o clique (inclusive no texto) ao checkbox uma única vez. Sem toggle duplo e com o rótulo associado ao controle (mais acessível).

**Verificação:** typecheck limpo + 96/96 Vitest.

---

## 21. Fix — rótulo "Mensalidade com Desconto" se contradizia sem desconto (06/07/2026)

Na mesma análise: na ficha do aluno o rótulo fixo "Mensalidade com Desconto" aparecia mesmo sem desconto, com o valor "Valor do plano" — lendo "Mensalidade com Desconto: Valor do plano", como se houvesse um desconto cujo valor fosse o próprio valor do plano.

- **Fix:** rótulo neutralizado para "Mensalidade". Lê corretamente nos dois casos: "Mensalidade: Valor do plano" (sem desconto) e "Mensalidade: R$ 99,90 (desconto individual)" (com desconto). O modo de edição mantém o texto de ajuda que explica a semântica do desconto.

**Verificação:** typecheck limpo + 96/96 Vitest.

---

### Backlog da análise de matrículas/aulas (a decidir o rumo antes de implementar)

- **(2) Ocupação com duas linguagens** ("N alunos" vs "X/Y vagas") conforme a modalidade tenha ou não `maxCapacity`; raiz é capacidade opcional, e turma sem capacidade nunca fica "lotada" (aceita matrícula sem limite). Decidir: tornar capacidade obrigatória (linguagem única) ou unificar a exibição.
- ~~**(4) Matrícula exige plano por turma**~~ → resolvido no item 22 (o fundador confirmou: cobrança é por modalidade, então plano-por-matrícula é o modelo certo; o defeito estava no motor de cobrança).
- **(5) Modelo "turma = N registros (um por dia)"** gera N+1 de rede e matrícula não-atômica (POSTs parciais). Candidato a endpoint de grupo transacional; maior esforço. (A cobrança já ficou imune à multiplicação por-dia no item 22, mas o N+1/atomicidade da matrícula continua em aberto.)

---

## 22. Entrega — Cobrança por modalidade: uma mensalidade por plano ativo do aluno (06/07/2026)

Fecha o item (4) da análise. **Decisão de produto do fundador:** a academia cobra **por modalidade** — aluno de Muay Thai + BJJ paga as duas mensalidades — e cada modalidade é **uma mensalidade separada** (não uma fatura somada). Isso valida o plano-por-matrícula (a tela estava certa); o defeito estava no motor de cobrança, que gerava **uma** mensalidade por aluno usando só o plano da matrícula ativa mais recente.

- **Motor de cobrança ([recurring.ts](server/lib/recurring.ts) + [recurringBilling.ts](server/jobs/recurringBilling.ts)):** a unidade de cobrança passou a ser o **plano distinto com matrícula ativa** (um por modalidade). `buildMonthlyCharges` emite uma cobrança por plano; o job monta os planos distintos das matrículas ativas do aluno.
- **Idempotência agora é por aluno+plano** (antes por aluno). Sem isso, a 2ª modalidade nunca seria cobrada (o aluno "já tinha pagamento no mês").
- **Imune à multiplicação por-dia (item 5):** as 3 linhas por-dia de uma turma "3x na semana" compartilham o mesmo plano → contam como **uma** modalidade → **uma** cobrança, não três. A dedup é por plano distinto.
- **Desconto individual (`customMonthlyAmount`):** valor absoluto, só se aplica quando o aluno tem **uma única modalidade** (preserva o comportamento atual). Com 2+ modalidades, cada plano cobra o preço cheio — um valor fixo não se divide de forma óbvia. Bolsista com várias modalidades fica como caso a revisitar (desconto por modalidade, se necessário).
- **Fallback legado mantido:** aluno sem matrícula ativa ainda usa o plano da última mensalidade (uma cobrança), para bases anteriores à UI de matrícula.

**Mudança de comportamento em dados reais (atenção):** alunos multi-modalidade estavam sendo **sub-cobrados** — só a modalidade mais recente virava mensalidade. A partir do próximo ciclo eles passam a ser cobrados por **todas** as modalidades ativas, então o total mensal desses alunos aumenta para o valor correto. Nenhuma mudança de UI foi necessária (o Financeiro já lista por pagamento, então o aluno aparece em uma linha por modalidade).

**Verificação:** typecheck limpo + **99/99 Vitest** (3 testes novos: 2 planos → 2 cobranças com preço cheio, idempotência por aluno+plano, desconto não se aplica com múltiplas modalidades). **Verificação isolada contra o banco** (`server/verify-billing.tmp.ts`, removido depois; sem inserir pagamentos, pois o job é global): aluno com 5 registros de matrícula (Muay 3 dias + BJJ 2 dias) resolve para 2 planos distintos → `buildMonthlyCharges` gera exatamente 2 cobranças (R$150 + R$120); 2ª rodada com Muay já cobrado gera só BJJ.

---

## 23. Fix — tela de Planos mostrava dados fixos; plano criado não aparecia (06/07/2026)

Reportado pelo fundador: criou o plano "BJJ" (toast de sucesso), mas ele não aparecia na lista. Causa: [PlanManagement.tsx](client/src/pages/PlanManagement.tsx) renderizava **dois planos hard-coded** (`useState` com "Jiu-Jitsu 3x" e "Plano Antigo 2024") — a tela nunca consultou a API, e os botões "Editar"/"Reativar" não tinham ação. O plano estava no banco (a criação persiste de verdade, e os modais de matrícula liam os planos reais); só a listagem era fake.

- **Frontend:** a tela passou a buscar `GET /api/membership-plans?includeInactive=true` via React Query, derivando periodicidade de `duration`, status de `active` e a contagem de alunos do backend. Estados de loading/erro/vazio. Os botões viraram **Desativar** (ativo → PATCH `active:false`, com confirmação que avisa sobre alunos já matriculados) e **Reativar** (inativo → `active:true`). "Editar" ficou fora deste passo (não há tela de edição ainda — decisão do fundador).
- **Backend:** `getMembershipPlansForManagement` (storage) retorna **todos** os planos (inclui inativos, para o Reativar), ativos primeiro, com `activeStudents` (contagem distinta de alunos ativos com matrícula ativa por plano). A rota `GET /membership-plans` ganhou o parâmetro `?includeInactive=true` só para a gestão — o endpoint padrão segue devolvendo **só ativos e sem contagem**, para os modais de matrícula não oferecerem plano inativo.
- **Causa-raiz do sintoma preservada:** [CreatePlan](client/src/pages/CreatePlan.tsx) passou a invalidar `['/api/membership-plans']` ao criar. Sem isso, o `staleTime` de 5min serviria a lista em cache e o plano novo só apareceria depois — reproduzindo o mesmo bug mesmo com a tela já ligada à API.

**Verificação:** typecheck limpo. **Backend** (`server/verify-plans.tmp.ts`, removido depois): endpoint de gestão traz 2 planos (ativo primeiro), `activeStudents` 1 e 0 corretos; endpoint padrão traz só o ativo e sem contagem. **e2e Playwright (porta 5001)**: lista mostra plano ativo e inativo; **plano criado pela UI aparece na lista** (o sintoma relatado); desativar → status "Inativo" + botão Reativar; reativar → "Ativo". Sem erros de console.

---

## 24. Entrega — Plano vinculado à modalidade + pré-seleção na matrícula (07/07/2026)

Melhoria (1) do backlog de matrículas/aulas, a que mais protege a cobrança por modalidade (item 22): o plano era texto livre, sem vínculo com a modalidade, então ao matricular numa turma de Muay Thai dava para escolher o plano de BJJ por engano e **cobrar errado**. Também criei planos de teste na academia demo (Anjo) para simular matrículas/financeiro: Judô, Karatê, Boxe, Capoeira, Passe Livre e BJJ Trimestral.

- **Schema:** `membership_plans.class_type_id` (nullable, FK → `class_types`). Null = geral / todas as modalidades (ex.: Passe Livre). Projeto usa `db:push` (sem pasta de migrações) — coluna aplicada no dev via ALTER equivalente; **produção precisa de `npm run db:push`**. Planos existentes do Anjo foram vinculados por backfill casando nome do plano × nome da modalidade.
- **Backend:** `POST`/`PATCH /membership-plans` aceitam `classTypeId` e validam que a modalidade é da própria academia (400 se não for). `getMembershipPlansForManagement` devolve `classTypeName` para a tela de gestão.
- **Criar plano:** ganhou seletor **Modalidade** (com opção "Geral"), e a tela de Planos ganhou a coluna **Modalidade** (badge da modalidade ou "Geral").
- **Pré-seleção (o ganho):** ao abrir a matrícula de uma turma ([ClassEnrollmentsDialog](client/src/components/ClassEnrollmentsDialog.tsx)) o plano já vem sugerido conforme a modalidade da turma; na ficha do aluno ([StudentClassEnrollments](client/src/components/StudentClassEnrollments.tsx)), ao escolher a turma o plano da modalidade é sugerido. O gestor ainda pode trocar; sem plano da modalidade (só gerais), fica em branco.

**Verificação:** typecheck limpo + **99/99 Vitest**. **Backend** (`server/verify-modality.tmp.ts`, removido): gestão devolve `classTypeName` ("Muay Thai Verify" / null p/ geral); `POST` com modalidade de outra academia → 400; com modalidade própria → 201 com `classTypeId`. **e2e Playwright (porta 5001)**: coluna Modalidade mostra modalidade/"Geral"; **matrícula por turma pré-seleciona o plano da modalidade** ("Plano Muay Verify"); criar plano com modalidade pela UI persiste e exibe. Sem erros de console.

**Backlog:** ainda abertos (2) ocupação e (5) N+1/atomicidade da matrícula. Anotado também: há planos órfãos "Plano E2E …" de testes antigos poluindo o banco — candidato a limpeza.

---

## 25. Entrega — Ocupação como contagem pura; app deixa de ter limite de vagas (07/07/2026)

Fecha o item (2) do backlog. **Decisão do fundador:** as aulas **não** devem ter limite de alunos — cada academia controla lotação por fora do app; o que importa é o gestor **saber quantos alunos** há em cada aula/modalidade/horário. (Isso reverteu uma primeira versão que ia no caminho de capacidade opcional + editor — descartada antes de commit.)

- **Ocupação = contagem ([enrollments.ts](client/src/lib/enrollments.ts)):** `occupancyText` passou a devolver só "N aluno(s)". Removidas a função `occupancy` e a interface `Occupancy` (label/isFull/hasLimit) — não há mais conceito de lotação no app. Fim do "N alunos" vs "N/Y vagas": tudo vira contagem.
- **Sem bloqueio no frontend ([ClassEnrollmentsDialog](client/src/components/ClassEnrollmentsDialog.tsx), [StudentClassEnrollments](client/src/components/StudentClassEnrollments.tsx), [ClassManagement](client/src/pages/ClassManagement.tsx)):** removidos o aviso "Turma lotada", os `disabled` por lotação, o "lotada" no dropdown e o badge vermelho de cheio. A ocupação vira badge neutro com a contagem.
- **Sem enforcement no backend ([enrollments.routes.ts](server/routes/enrollments.routes.ts)):** removida a checagem `hasCapacity` que retornava 409 "Turma lotada" — era ela que, na verificação, barrava a matrícula mesmo com o front liberado. Função `hasCapacity` e seus testes removidos.
- **`maxCapacity` fica vestigial:** a coluna e o campo permanecem no schema/seeds (o BJJ demo tem 20), mas **nada** no app lê ou impõe — sem migração destrutiva. Candidato a remoção futura.

**Verificação:** typecheck limpo + **87/87 Vitest** (removido o teste de `hasCapacity`; testes de `occupancyText` reduzidos à contagem). **e2e Playwright (porta 5001)** com turma de `maxCapacity=1` (legado) para provar que passa do "limite": ocupação mostra "0 alunos" (sem "/1", sem "vagas"); 1ª matrícula → "1 aluno"; **2ª matrícula passa do limite 1 → "2 alunos"**, sem aviso de lotada e com o botão habilitado. Sem erros de console.

**Backlog:** resta (5) N+1/atomicidade da matrícula e a faxina dos planos "Plano E2E …".

---

## 26. Entrega — Resumo de alunos por modalidade na Gestão de Aulas (07/07/2026)

Complemento do item 25, a pedido do fundador: "o importante é o gestor saber quantos alunos há em cada modalidade". A tela de Aulas mostrava só por aula (por linha); faltava o total por modalidade.

- **Backend ([storage.ts](server/storage.ts) + [classes.routes.ts](server/routes/classes.routes.ts)):** novo `getModalityEnrollmentSummary` e `GET /api/classes/modality-summary` — por modalidade ativa, **alunos ativos distintos** (não duplica quem faz várias turmas da mesma modalidade) e **nº de turmas** (combinação distinta professor+horário), ordenado por mais alunos.
- **Frontend ([ClassManagement](client/src/pages/ClassManagement.tsx)):** painel "Alunos por modalidade" acima da tabela, com um card por modalidade (nome, contagem de alunos, nº de turmas). A query usa a key `['/api/classes', 'modality-summary']` — filha do prefixo `['/api/classes']`, então matricular/remover **atualiza o painel sozinho** (as mutações de matrícula já invalidam esse prefixo).

**Verificação:** typecheck limpo + **87/87 Vitest**. **Backend** (`server/verify-summary.tmp.ts`, removido): aluno em 2 turmas de Muay Thai + 1 de BJJ → Muay Thai {alunos:2 (distintos), turmas:2}, BJJ {alunos:1, turmas:1}, ordenado por alunos. **e2e Playwright (porta 5001)**: painel aparece com os cards corretos (Muay Thai "2 alunos / 2 turmas", BJJ "1 aluno / 1 turma"), Muay Thai primeiro. Sem erros de console.

**Backlog:** resta (5) N+1/atomicidade da matrícula e a faxina dos planos "Plano E2E …".

---

## 27. Entrega — Matrícula em turma vincula modalidade + graduação inicial (07/07/2026)

Fecha a divergência entre as duas fontes de "aluno pratica a modalidade": os badges da lista de Alunos liam `student_modality_enrollments`/ranks, mas matricular em turma só gravava `enrollments` — aluno matriculado podia não aparecer como praticante. **Regra de modelagem adotada:** toda matrícula em turma implica vínculo com a modalidade da turma; o vínculo pode existir sem turma (aula particular, legado), nunca o inverso.

- **Serviço ([modality-enrollment.service.ts](server/services/modality-enrollment.service.ts)):** `ensureModalityEnrollment` garante o vínculo ativo + graduação inicial (primeira faixa do sistema da modalidade, com entrada no histórico) se o aluno ainda não tem rank. Usado por `POST /classes/:id/enrollments` (novo) e `POST /students/:id/modality-enrollments` (que já fazia isso inline — código movido, não duplicado).
- **Resposta da matrícula** devolve `modalityAdded`/`modalityName`; os toasts ([ClassEnrollmentsDialog](client/src/components/ClassEnrollmentsDialog.tsx), [StudentClassEnrollments](client/src/components/StudentClassEnrollments.tsx)) anunciam "modalidade X adicionada ao perfil" só quando o vínculo é novo. Invalidações passam a cobrir `modality-enrollments`/`modality-ranks`/badges da lista.
- **Resumo por modalidade ([storage.ts](server/storage.ts)):** `getModalityEnrollmentSummary` conta praticantes pelo **vínculo** (`student_modality_enrollments` + ranks de legado) — mesmo critério dos badges — em vez de matrículas em turma. Aluno sem turma continua contado como praticante.
- **Ficha do aluno ([StudentDetailDialog](client/src/components/StudentDetailDialog.tsx)):** seções "Modalidades e Graduações" e "Turmas" unificadas em **"Modalidades e Turmas"** — um card por modalidade (barra na cor da faixa + BeltBar + nome da graduação) com as turmas aninhadas dentro. Remover turma mantém modalidade/graduação (o AlertDialog agora diz isso); turma de modalidade sem vínculo (legado pré-backfill) ganha card próprio sem graduação. O repeater de edição não mudou.
- **Backfill ([backfill-modality-enrollments.ts](server/backfill-modality-enrollments.ts), `npm run backfill:modalidades`):** cria/reativa vínculos a partir das matrículas ativas (enrolled_at = menor start_date) e atribui graduação inicial (promoted_by = admin mais antigo da academia) com histórico. Idempotente (ON CONFLICT). **Rodado no dev: 0 lacunas** (base já consistente). **Produção: rodar após deploy.**

**Verificação:** typecheck limpo + **87/87 Vitest**. **e2e Playwright (porta 5001, fixture verify-tmp removida ao final):** ficha vazia ("Nenhuma modalidade ainda") → matricular na turma → toast "modalidade Kickboxing VT adicionada ao perfil", card com faixa **Branca** (graduação inicial automática) e turma aninhada; **remover turma mantém modalidade + graduação** ("Sem turma — matricule abaixo…"); `GET /api/classes/modality-summary` conta **1 praticante mesmo sem turma**; rematrícula com vínculo já ativo → toast simples. Sem erros de console. **Backfill provado** com lacuna artificial na fixture (2 matrículas-dia → 1 vínculo + 1 graduação + 1 histórico) e idempotente na 2ª execução (0). Faxina de academias e2e: 0 órfãs restantes (banco já limpo).

**Backlog:** resta (5) N+1/atomicidade da matrícula (agora com mais uma escrita por request, reforça o caso para transação).

---

## 28. Entrega — Matrícula em grupo transacional: fim do N+1 (07/07/2026)

Fecha o item (5) do backlog, o último da série de matrículas/aulas. O modelo "turma = N registros (um por dia)" gerava N requests por matrícula (POSTs sequenciais) e N por remoção (DELETEs paralelos), com risco de estado meio-matriculado quando um request do meio falhava.

- **Serviço ([class-enrollment.service.ts](server/services/class-enrollment.service.ts)):** `enrollStudentInClassGroup` valida o grupo inteiro (turmas da academia, ativas, mesma modalidade; aluno ALUNO ativo; plano da academia) e grava tudo em **uma transação**: INSERT multi-linha das matrículas + vínculo de modalidade + graduação inicial. Rematrícula parcial é idempotente (`skippedClassIds`). `unenrollStudentFromClassGroup` encerra o grupo com **um único UPDATE** (atômico por construção).
- **`ensureModalityEnrollment` ficou tx-aware:** trocou chamadas ao storage por queries Drizzle diretas e aceita um executor (transação) opcional — os 3 registros (vínculo + rank + histórico) nascem juntos. O `POST /students/:id/modality-enrollments` também passou a envolver em transação.
- **Rotas ([classes.routes.ts](server/routes/classes.routes.ts)):** `POST /api/classes/enrollment-groups` (201 com `enrollments`, `skippedClassIds`, `modalityAdded`, `modalityName`) e `DELETE /api/classes/enrollment-groups` (body `{studentId, classIds}`, máx. 14). O **POST unitário** `/classes/:classId/enrollments` virou casca fina do serviço (grupo de 1) — mantém contrato (201/409) e agora também é transacional.
- **Frontend ([ClassEnrollmentsDialog](client/src/components/ClassEnrollmentsDialog.tsx), [StudentClassEnrollments](client/src/components/StudentClassEnrollments.tsx)):** os loops de POST/DELETE viraram um request cada; toasts e invalidações inalterados.
- **Spec e2e 05 consertada de tabela:** ainda esperava ocupação "0/20" do modelo pré-item 25 — atualizada para a contagem ("0 alunos"/"1 aluno"). O teste de `sanitize` ganhou mock de `../db` (a nova cadeia de import avalia `db.ts`).

**Verificação:** typecheck limpo + **87/87 Vitest** + **suíte Playwright 14 passed / 15 skipped** (spec 05 inteira verde de novo). **e2e Playwright dirigido (porta 5001, fixture verify-tmp, contadores de rede):** grupo de 2 dias matriculado com **exatamente 1 POST** (0 legados) nas duas telas; remoção com **exatamente 1 DELETE**; card/toast/graduação inicial sem regressão. **API:** grupo com classId inexistente → 404 e **nenhuma matrícula parcial** (tudo-ou-nada); unitário legado 201 + 409 em duplicata; rematrícula parcial cria só o dia faltante e reporta `skippedClassIds`. Faxina pós-suíte: 0 academias e2e e 0 planos "Plano E2E …" restantes.

**Backlog da série de matrículas: zerado.** Pendências gerais seguem: reescrever specs e2e 03/04, lembrete WhatsApp, multa/bloqueio por inadimplência, remoção futura do `maxCapacity` vestigial.

---

## 29. Entrega — Specs e2e 03/04 reescritos contra a UI atual (07/07/2026)

Fecha a pendência mais antiga da suíte (aberta em 03/07): os specs 03 (fluxos de UI) e 04 (performance/integração) estavam em `describe.skip` porque navegavam pela primeira versão da interface (testids `nav-alunos`, `tab-modalidades`, `metric-students`… extintos). Reescritos do zero preservando a intenção de cada teste.

- **Spec 03 — Fluxos principais (7 testes):** cadastro de academia pela UI (landing → /cadastro → dashboard), ciclo de alunos (criar pelo dialog, buscar, limpar busca), modalidade via Configurações (chips de esportes) + agendamento de aula pelo dialog, grade horária com 3 aulas, login/logout (com limpeza do token), validação de formulários (cadastro vazio, medidor de força de senha, login inválido) e responsividade mobile (bottom nav + formulário em 375px).
- **Spec 04 — Performance e integração (8 testes):** orçamento de carga do dashboard e da lista com 20 alunos (teto de 5s — regressão grosseira, não SLO), sincronia API↔UI nos dois sentidos, refresh reflete mudanças externas, fluxo completo modalidade→aula→grade→API (GET /classes devolve grupos com `daysOfWeek`), falha de rede no POST preserva o formulário e mostra toast de erro, XSS (nome `<script>` renderiza escapado; listener de dialog falha o teste se executar) e acessibilidade (nomes acessíveis na sidebar, `label[for]` nos inputs do dialog, Escape fecha).
- **Helpers:** `createTestAcademy` agora guarda o payload do usuário (`rawUser`) — o client exige `localStorage[user]` além do token (padrão do spec 05). Armadilhas da UI atual documentadas nos specs: layout desktop+mobile renderizam juntos (asserts filtram por `visible: true`) e testids duplicados entre os dois layouts.
- **Convenção de faxina:** nomes de academia dos specs contêm "E2E" para o slug casar com a limpeza `slug ~ e2e`.

**Verificação:** typecheck limpo + **suíte Playwright completa 29 passed / 0 skipped** (primeira vez sem skips; antes: 14 passed / 15 skipped). Faxina pós-suíte: 64 academias de teste removidas, 0 restantes.

**Backlog:** pendências gerais seguem: lembrete WhatsApp, multa/bloqueio por inadimplência, remoção do `maxCapacity` vestigial. Da suíte e2e, nada pendente.

---

## 30. Entrega — Relatório de retenção/churn no Dashboard (07/07/2026)

Item de maior valor do roadmap da auditoria (§5.3): alerta proativo de alunos sumindo, usando dados que já existem em `attendance` — sem mudança de schema.

- **Lógica pura ([retention.ts](server/lib/retention.ts), 9 testes):** baseline = última presença com status `presente` (**falta não conta como "veio"**); quem nunca veio usa a data de cadastro (aluno novo não é "em risco" no dia 1). Buckets: atenção ≥ 14 dias, risco ≥ 30, ordenado piores-primeiro.
- **Storage `getRetentionRows`:** 1 query (LEFT JOIN + `max() filter`). Armadilha encontrada: o `max()` cru devolve timestamp *naive* do Postgres e `new Date(string)` parseia como hora local — errava a contagem por 1 dia. `mapWith(attendance.date)` decodifica com o mesmo decoder da coluna (UTC).
- **`GET /api/dashboard/retention`** devolve limiares, contagens por bucket e só quem precisa de ação.
- **Painel ([DashboardRetention](client/src/components/DashboardRetention.tsx)):** "Retenção — presença em queda" entre as métricas e as tendências: contadores (vermelho/âmbar), até 8 linhas ("sem treinar há N dias" / "nunca veio · há N dias na academia"), clique abre a ficha, "mostrar mais" expande. Vazio: "Todos os alunos ativos treinaram nos últimos 14 dias."

**Verificação:** typecheck limpo + **104/104 Vitest** + suíte Playwright **29 passed**. **e2e dirigido (porta 5001, fixture verify-tmp com 4 alunos):** contadores "2 em risco / 1 em atenção"; linhas com 45/40/20 dias corretos — inclusive prova de que **falta recente não zera o contador** (aluno com falta há 5 dias segue "sem treinar há 45"); assíduo (2 dias) fora da lista; ordenação piores-primeiro; clique navega à ficha. Sem erros de console.

---

## 31. Entrega — Fix de fuso: datas date-only não deslocam mais um dia (07/07/2026)

Fecha o bug pré-existente do §18: pagamento registrado dia 06/07 aparecia "pago em 05/07", e vencimento de 01/08 caía no filtro de **julho**.

- **Causa:** duas famílias de timestamps no banco — formulários enviam `YYYY-MM-DD` (vira meia-noite UTC) e a cobrança recorrente grava meio-dia local. Exibir no fuso do browser (UTC-3) desloca as de meia-noite UTC um dia para trás; **exibir em UTC acerta as duas**.
- **[dates.ts](client/src/lib/dates.ts) (8 testes):** `formatDateOnly`, `formatMonthYear`, `monthKeyOf`/`monthLabelOf` com partes UTC. FinancialControl migrado em 8 pontos (tabela, CSV, dialog de detalhe, "desde" dos devedores, agrupamento/filtro de período).
- **Fora do escopo (anotado):** `overdueCutoff` (meia-noite local, convenção compartilhada client/servidor) tem borda do mesmo tipo — pagamento de meia-noite UTC pode virar "atrasado" às 21h da véspera. Mexer só de um lado criaria divergência; fica para tratamento conjunto.

**Verificação e2e (fixture com pagamentos de meia-noite UTC):** "pago em 06/07/2026" exibe **06/07** (e "05/07/2026" não aparece em lugar nenhum da tela); vencimento de 01/08 gera o mês **"Agosto de 2026"** no filtro de período. Sem erros de console.

**Operacional:** faxina e2e virou script permanente (`npm run e2e:clean`, guardado por slug ~ e2e). **Pendências para o deploy em produção** (sem credencial local — rodar lá): `npm run db:push` e `npm run backfill:modalidades`.

**Backlog:** lembrete WhatsApp, multa/bloqueio por inadimplência, `maxCapacity` vestigial, borda do `overdueCutoff`, ranking de assiduidade, check-in QR, sugestão de graduação.

---

## 32. Entrega — Sugestão de graduação no Dashboard (08/07/2026)

Último item "só leitura de dados existentes" do roadmap da auditoria (§5.6): candidatos a promoção por modalidade, cruzando presenças acumuladas com tempo na faixa atual. É **sugestão, não automação** — o registro continua manual, pela ficha do aluno.

- **Critério ([graduation-suggestion.ts](server/lib/graduation-suggestion.ts), 8 testes):** tempo na faixa ≥ **90 dias** E presenças na modalidade desde a promoção ≥ **20** E existe próxima faixa no sistema (quem está na última não é candidato). Constantes exportadas, não configuráveis por enquanto. Ordenação por prontidão (presenças, depois tempo de faixa).
- **Storage `getGraduationCandidateRows`:** 1 query — `student_modality_ranks` × users ativos × class_types ativos × faixa atual, com subqueries correlacionadas para a **próxima faixa do mesmo sistema** (displayOrder) e a **contagem de presenças desde promoted_at** (só status `presente`, via join attendance→classes por modalidade).
- **`GET /api/dashboard/graduation-suggestions`** devolve limiares + sugestões.
- **Painel ([DashboardGraduationSuggestions](client/src/components/DashboardGraduationSuggestions.tsx)):** "Sugestões de graduação" entre a retenção e as tendências — linha com nome, modalidade, BeltBar da faixa atual → próxima, "N presenças · há D dias na faixa"; clique abre a ficha; sem candidatos o painel **não renderiza** (sugestão vazia não é informação acionável).

**Verificação:** typecheck limpo + **112/112 Vitest** + suíte Playwright **29 passed**. **e2e dirigido (porta 5001, fixture verify-tmp com 4 cenários):** só o aluno pronto (100 dias, 25 presenças) é sugerido, com "Kickboxing VT · Branca → Azul · **25 presenças** · há 100 dias na faixa" — as 5 presenças **anteriores à promoção** e as 2 **faltas** não contam; recém-promovido (10 dias/30 presenças), poucas presenças (120 dias/3) e faixa máxima (Azul, sem próxima) ficam de fora; clique navega à ficha. Sem erros de console. Faxina pós-suíte: 15 academias e2e removidas, 0 restantes.

**Backlog:** lembrete WhatsApp (aguarda decisão de provedor), multa/bloqueio por inadimplência, check-in QR, ranking de assiduidade, `maxCapacity` vestigial, borda do `overdueCutoff`; produção: `db:push` + `backfill:modalidades` no deploy.

---

## 33. Entrega — Painel de retenção vira opt-in (Configurações → Painel) (08/07/2026)

**Decisão do fundador:** em academias com muitos alunos a lista de retenção pode poluir o Dashboard — o painel passa a vir **oculto por padrão**, ativável em Configurações.

- **Schema:** `academies.dashboard_show_retention` (boolean, **default false**). Aplicada no dev via ALTER equivalente; **produção: `npm run db:push` no deploy** (mesmo passo já pendente das colunas anteriores).
- **Backend:** `GET /api/dashboard/retention` ganhou gate — preferência desligada devolve só `{ enabled: false }` **sem rodar a query**. Novo par `GET/PATCH /api/dashboard/preferences` (`{ showRetention }`); PATCH só para ADMIN_ACADEMIA (professor → 403).
- **Configurações:** nova aba **Painel** ao lado de "Modalidades & Graduações", com Switch "Retenção — presença em queda" + explicação do porquê de vir desligado. Mutação invalida `preferences` e `retention` (o Dashboard reage sem reload).
- **Dashboard:** `DashboardRetention` renderiza `null` quando `enabled: false`.

**Verificação:** typecheck limpo + **112/112 Vitest** + suíte Playwright **29 passed**. **e2e dirigido (fixture verify-tmp com aluno 40 dias sumido):** padrão = painel **não aparece** mesmo com aluno em risco no banco; ligar o toggle em Configurações → Painel (toast confirma) → Dashboard mostra o painel com o aluno; desligar → some de novo; **PATCH como professor → 403**. Sem erros de console.

**Backlog:** inalterado (WhatsApp, multa/bloqueio, check-in QR, ranking de assiduidade, `maxCapacity`, borda do `overdueCutoff`); produção: `db:push` (agora inclui esta coluna) + `backfill:modalidades`.
