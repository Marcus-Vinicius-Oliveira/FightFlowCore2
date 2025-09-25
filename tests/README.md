# Suíte de Testes E2E - Centro de Lutas

Esta documentação descreve a suíte completa de testes automatizados end-to-end (E2E) implementada com Playwright para validar a integridade e segurança da plataforma Centro de Lutas.

## 📋 Visão Geral dos Testes

### 🔒 1. Testes de Segurança Multi-Tenancy (01-multi-tenancy-security.spec.ts)
Valida o isolamento completo de dados entre academias:
- **1.1** - Isolamento de dados entre academias
- **1.2** - Tentativa de acesso a dados de outra academia via API  
- **1.3** - Validação de tokens JWT entre academias
- **1.4** - Isolamento na busca de alunos
- **1.5** - Proteção de criação de usuários em academia incorreta

### 👥 2. Controle de Acesso RBAC (02-rbac-access-control.spec.ts)
Testa permissões baseadas em roles (ADMIN_ACADEMIA, PROFESSOR, ALUNO):
- **2.1** - Acesso do admin a todas as funcionalidades
- **2.2** - Restrições de acesso do professor
- **2.3** - Restrições de acesso do aluno
- **2.4** - Tentativas de acesso não autorizado
- **2.5** - Proteção de rotas administrativas

### 🔄 3. Fluxos Principais (03-main-user-flows.spec.ts)
Valida os principais casos de uso da aplicação:
- **3.1** - Cadastro completo de academia e primeiro acesso
- **3.2** - Ciclo completo de gerenciamento de alunos
- **3.3** - Criação de modalidades e agendamento de aulas
- **3.4** - Visualização da grade horária semanal
- **3.5** - Login e logout de usuário existente
- **3.6** - Validação de formulários e tratamento de erros
- **3.7** - Responsividade em dispositivos móveis

### ⚡ 4. Performance e Integração (04-performance-integration.spec.ts)
Testes de performance, consistência e segurança:
- **4.1** - Carregamento rápido do dashboard (< 3s)
- **4.2** - Lista com muitos registros (< 5s para 20+ alunos)
- **4.3** - Consistência entre API e UI
- **4.4** - Invalidação de cache
- **4.5** - Fluxo completo de gerenciamento de aulas
- **4.6** - Tratamento de erros de conectividade
- **4.7** - Proteção contra XSS
- **4.8** - Acessibilidade e navegação por teclado

## 🛠 Como Executar os Testes

### Pré-requisitos
1. Aplicação rodando: `npm run dev`
2. Banco de dados disponível
3. Playwright instalado: `npx playwright install`

### Comandos de Execução

```bash
# Executar todos os testes
npx playwright test

# Executar com interface gráfica
npx playwright test --ui

# Executar em modo debug
npx playwright test --debug

# Executar testes específicos
npx playwright test tests/e2e/01-multi-tenancy-security.spec.ts
npx playwright test tests/e2e/02-rbac-access-control.spec.ts
npx playwright test tests/e2e/03-main-user-flows.spec.ts
npx playwright test tests/e2e/04-performance-integration.spec.ts

# Visualizar relatório de resultados
npx playwright show-report
```

### Executar por Categoria

```bash
# Apenas testes de segurança
npx playwright test --grep "Segurança Multi-Tenancy"

# Apenas testes de RBAC
npx playwright test --grep "Controle de Acesso RBAC"

# Apenas testes de performance
npx playwright test --grep "Performance"
```

## 🔧 Arquitetura dos Testes

### Estrutura de Arquivos
```
tests/
├── helpers/
│   └── test-utils.ts          # Utilitários e helpers centralizados
├── e2e/
│   ├── 01-multi-tenancy-security.spec.ts
│   ├── 02-rbac-access-control.spec.ts
│   ├── 03-main-user-flows.spec.ts
│   └── 04-performance-integration.spec.ts
├── playwright.config.ts       # Configuração do Playwright
└── README.md                  # Esta documentação
```

### Test Helpers (test-utils.ts)
Classe `TestHelpers` fornece:
- Criação automática de academias de teste
- Geração de dados únicos por teste
- Cleanup automático após cada teste
- Utilitários para API requests
- Criação de usuários com diferentes roles

### Padrões de Nomenclatura
- **Test IDs**: `data-testid="action-target"` (ex: `button-submit`, `input-email`)
- **Dados de Teste**: Prefixos únicos por categoria + timestamp
- **Cleanup**: Automático via `test.afterEach()`

## 📊 Métricas e Benchmarks

### Performance Targets
- **Dashboard**: Carregamento < 3 segundos
- **Listas**: Até 5 segundos para 20+ registros
- **Formulários**: Validação instantânea
- **Navegação**: Transições fluidas

### Cobertura de Segurança
- ✅ Isolamento multi-tenant completo
- ✅ Controle de acesso RBAC
- ✅ Proteção contra XSS
- ✅ Validação de tokens JWT
- ✅ Autorização de endpoints

### Acessibilidade
- ✅ Navegação por teclado
- ✅ Labels e ARIA attributes
- ✅ Contraste de cores
- ✅ Compatibilidade com screen readers

## 🐛 Debugging e Troubleshooting

### Problemas Comuns

**1. Testes falhando por timeout**
```bash
# Aumentar timeout global
npx playwright test --timeout=60000
```

**2. Dados de teste persistindo**
```bash
# Verificar cleanup nos logs
npx playwright test --reporter=line
```

**3. Problemas de conectividade**
```bash
# Verificar se aplicação está rodando
curl http://localhost:5000/api/health
```

### Debug Avançado

**Modo headful (ver browser)**
```bash
npx playwright test --headed
```

**Screenshots em falhas**
```bash
npx playwright test --screenshot=only-on-failure
```

**Trace viewer**
```bash
npx playwright test --trace=retain-on-failure
npx playwright show-trace trace.zip
```

## 🔍 Validações Implementadas

### Segurança Multi-Tenant
- [ ] Academia A não acessa dados da Academia B
- [ ] Tokens JWT são específicos por academia
- [ ] APIs retornam apenas dados da academia logada
- [ ] Criação de usuários respeita contexto da academia

### Controle de Acesso (RBAC)
- [ ] Admin tem acesso total
- [ ] Professor acessa apenas funcionalidades permitidas
- [ ] Aluno tem acesso restrito ao portal do aluno
- [ ] Rotas protegidas rejeitam acessos não autorizados

### Funcionalidades Core
- [ ] CRUD completo de alunos
- [ ] Criação e gerenciamento de modalidades
- [ ] Agendamento de aulas
- [ ] Visualização de grade horária
- [ ] Autenticação e autorização

### Performance e UX
- [ ] Tempos de carregamento adequados
- [ ] Responsividade em dispositivos móveis
- [ ] Tratamento adequado de erros
- [ ] Validação de formulários
- [ ] Acessibilidade

## 📈 Relatórios e Monitoramento

Os testes geram automaticamente:
- **HTML Report**: Resultados detalhados com screenshots
- **JUnit XML**: Para integração com CI/CD
- **Traces**: Para debugging de falhas
- **Screenshots**: Capturas em pontos de falha

### Integração Contínua
Esta suíte de testes está preparada para integração com pipelines de CI/CD, validando automaticamente:
- Segurança multi-tenant
- Controle de acesso
- Funcionalidades críticas
- Performance
- Regressões

---

## 📝 Notas de Desenvolvimento

### Credenciais de Teste Padrão
Para testes manuais rápidos:
- **Email**: admin8@testacademy.com
- **Senha**: 123456
- **Role**: ADMIN_ACADEMIA

### Ambiente de Teste
- **URL Base**: http://localhost:5000
- **Banco**: PostgreSQL (desenvolvimento)
- **Timeout Padrão**: 30 segundos
- **Paralelização**: 1 worker (para isolamento)

### Próximos Passos
- [ ] Testes de carga com K6
- [ ] Testes de API com Postman/Newman
- [ ] Testes de regressão visual
- [ ] Monitoramento contínuo de performance