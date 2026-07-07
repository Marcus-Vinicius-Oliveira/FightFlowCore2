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
- **(4) Matrícula exige plano por turma** — plano costuma ser da mensalidade do aluno (por pessoa), não por turma; hoje pede plano a cada matrícula e permite planos conflitantes. Definição de produto/modelagem pendente.
- **(5) Modelo "turma = N registros (um por dia)"** gera N+1 de rede e matrícula não-atômica (POSTs parciais). Candidato a endpoint de grupo transacional; maior esforço.
