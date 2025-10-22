## Orientações rápidas para agentes AI — FightFlowCore

Este repositório é uma aplicação fullstack (client + server) TypeScript que serve uma SPA React via Vite e expõe uma API em Express. O backend usa Drizzle ORM com Postgres (DATABASE_URL obrigatório). Abaixo estão pontos acionáveis e específicos para desenvolver aqui.

- Arquitetura principal
  - Cliente: `client/` com Vite + React + Tailwind. Entrypoint do build servido por `vite` e integrado ao servidor.
  - Servidor: `server/` (Express). Entry: `server/index.ts`. Rotas registradas em `server/routes.ts` e persistência em `server/storage.ts` usando Drizzle + Neon/Neon-serverless.
  - Schemas/Tipos: `shared/schema.ts` (usado por server e client).

- Scripts úteis (via `package.json`)
  - `npm run dev` — ambiente de desenvolvimento (executa `tsx server/index.ts` e integra com Vite). Use este para desenvolvimento local.
  - `npm run build` — constrói client com `vite build` e empacota `server/index.ts` com `esbuild` em `dist/`.
  - `npm run start` — executa `node dist/index.js` (após build).
  - `npm run check` — executa `tsc`.
  - `npm run db:push` — aplica migrations com `drizzle-kit push` (requer `DATABASE_URL`).

- Variáveis de ambiente importantes
  - `DATABASE_URL` — obrigatório para executar em qualquer modo que acesse o DB (drizzle, seeds, server). Falha rápido se não estiver definido.
  - `JWT_SECRET` — se ausente, o código usa um segredo de desenvolvimento (veja `server/auth.ts`) e imprime um aviso. Para produção, sempre setar esta variável.
  - `PORT` — porta servida pelo servidor (padrão 5000).

- Padrões e convenções do projeto
  - Multitenancy por `academyId` embutido no JWT. NUNCA confiar em `academyId` vindo do corpo/requisição: use o `req.user.academyId` (veja `server/routes.ts` e middlewares `requireSameAcademy`).
  - Roles definidas: `SUPER_ADMIN`, `ADMIN_ACADEMIA`, `PROFESSOR`, `ALUNO`. Use helpers em `server/auth.ts` para validação de permissões.
  - Validação de entrada: padrões de Zod são definidos em `shared/schema.ts` e reutilizados nos endpoints (importados em `server/routes.ts`). Prefira reusar esses schemas.
  - Segurança: as queries DB passam por `server/storage.ts` (classe `DatabaseStorage`) — responsabilidade única para operações SQL.

- Integração com DB e seeds
  - `drizzle.config.ts` aponta `schema: './shared/schema.ts'` e saída de migrations em `./migrations`.
  - Seeds estão em `server/seeds.ts` e usam a mesma configuração `DATABASE_URL`.

- Testes e E2E
  - Suíte E2E com Playwright está em `tests/` com config em `playwright.config.ts` e helpers em `tests/helpers/test-utils.ts`.
  - Para executar localmente: garantir DB provisionado, então executar os testes com `npx playwright test` do root.

- Exemplos rápidos (como o agente deve editar/gerar código)
  - Quando alterar modelos/tabelas em `shared/schema.ts`, lembre-se de gerar/atualizar migrations (`npm run db:push`) e atualizar seeds se necessário.
  - Ao adicionar um endpoint que acessa dados por tenant, copie o padrão: `authenticateToken`, `requireRole([...])`, `requireSameAcademy` e use `storage` para operações.
  - Ao alterar UI, use aliases definidos em `components.json` (ex: `@/components`, `@/lib`) e atualize `client/src` correspondemente.

- Locais importantes para leitura rápida
  - `server/index.ts`, `server/routes.ts`, `server/storage.ts`, `server/auth.ts`
  - `shared/schema.ts` (tipos + zod), `drizzle.config.ts`
  - `client/` (frontend), `components.json`, `vite.config.ts`
  - `tests/` (Playwright E2E) e `tests/README.md`

## Executar localmente (PowerShell)

Antes de qualquer execução local que acesse o banco, exporte `DATABASE_URL` e (opcionalmente) `JWT_SECRET` e `PORT`.

Exemplos em PowerShell (Windows) — substitua os valores por aqueles do seu ambiente:

```powershell
$env:DATABASE_URL = 'postgres://user:pass@host:5432/dbname'
$env:JWT_SECRET = 'uma-senha-secreta-para-desenvolvimento'
$env:PORT = '5000'

# Rodar em modo desenvolvimento (Vite + servidor Express)
npm run dev

# Gerar migrations/atualizar DB (requer DATABASE_URL)
npm run db:push

# Build para produção
npm run build

# Start (após build)
npm run start
```

Observações:
- Em ambientes *nix a sintaxe é diferente; aqui documentamos PowerShell porque o maintainer usa Windows.
- `drizzle-kit push` (chamado via `npm run db:push`) falha se `DATABASE_URL` não estiver definido.
- Se `JWT_SECRET` estiver ausente, o servidor usa um segredo de desenvolvimento (ver `server/auth.ts`) — não usar isso em produção.

## Exemplos para shells *nix (bash / zsh)

Se você estiver em macOS ou Linux, exporte variáveis de ambiente assim:

```bash
export DATABASE_URL='postgres://user:pass@host:5432/dbname'
export JWT_SECRET='uma-senha-secreta-para-desenvolvimento'
export PORT='5000'

# Rodar em modo desenvolvimento
npm run dev

# Gerar migrations/atualizar DB
npm run db:push

# Build para produção
npm run build

# Start (após build)
npm run start
```

Dica: use `env | grep DATABASE_URL` para confirmar a variável no ambiente da sessão.

## Mini-checklist: configurar o banco localmente

1. Provisionar um banco Postgres acessível (local, Docker ou serviço). Exemplo rápido com Docker:

```bash
docker run --rm -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -e POSTGRES_DB=dbname -p 5432:5432 -d postgres:15
```

2. Exportar `DATABASE_URL` apontando para o banco (veja exemplos acima).
3. Gerar/atualizar migrations:

```bash
npm run db:push
```

4. (Opcional) Rodar seeds para popular dados iniciais (se `server/seeds.ts` estiver presente, use um script personalizado - revisar `server/seeds.ts`).
5. Iniciar em modo dev e verificar logs/API:

```bash
npm run dev
```

6. Testar endpoints básicos: `/api/auth/login` e `/api/auth/me` (use Postman/HTTPie/cURL) para garantir que autenticação e multitenancy estão funcionando.

Observação final: o projeto exige `DATABASE_URL` em muitas operações. Se um comando falhar com erro relacionado a DB, verifique primeiro essa variável e a conectividade de rede/porta.
