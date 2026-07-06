---
name: verify
description: Receita de verificação e2e do FightFlowCore2 — como subir o app isolado e dirigir a UI com Playwright.
---

# Verificação e2e — FightFlowCore2

## Subir o app para verificação

- O dev server do usuário costuma estar rodando na porta 5000 — **não mexer nele** (e ele pode estar com código antigo; não sirva de superfície de verificação).
- `npm run dev` usa `tsx watch`, que **trava sem log quando roda em background sem TTY no Windows**. Para verificação, suba sem watch em outra porta:

```bash
PORT=5001 NODE_ENV=development npx tsx --env-file=.env server/index.ts   # run_in_background
```

- Sobe em ~2s (log: `serving on port 5001`). Health check: `GET /api/health`.
- Express serve o client via Vite middleware — a UI fica no mesmo host/porta.

## Login na UI (Playwright)

- Playwright já está no projeto (`@playwright/test`). Scripts fora do repo precisam importar por caminho absoluto: `import { chromium } from 'file:///F:/FightFlowCore2_CLAUDE/FightFlowCore2/node_modules/playwright/index.mjs'`.
- Rota de login do admin: `/login`. Testids: `input-login-email`, `input-login-password`, `button-login-submit`. Redireciona para `/dashboard`.
- Token JWT fica em `localStorage['auth_token']` (não `token`) — útil para checagens de API com o mesmo login.

## Credenciais / fixtures

- Não há credencial de admin conhecida em seeds (senha do seed demo é só de alunos: `Senha@123`; academia demo tem slug `anjo`).
- Padrão validado: criar fixtures temporárias direto no banco com e-mails `@verify.tmp` (admin ADMIN_ACADEMIA + aluno + payment), usar, e apagar tudo no final (payments → users). Scripts de setup/cleanup precisam ficar **dentro do repo** (ex.: `server/*.tmp.ts`) para o tsx resolver os módulos; apagar depois.

## Gotchas

- O banco é compartilhado com o dev server do usuário — só mexa em registros das fixtures `@verify.tmp`.
- Datas date-only (`YYYY-MM-DD`) enviadas ao backend são parseadas como UTC e exibidas com `toLocaleDateString` local (UTC-3) → aparecem um dia antes na UI.
- Rotas principais: financeiro em `/dashboard/financeiro`; testids seguem `button-*`/`input-*`/`filter-*` (grep por `data-testid` na página).
