# MoneyCapy — Documentação Técnica

## Índice
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Processo Principal (Electron)](#3-processo-principal-electron)
4. [Banco de Dados](#4-banco-de-dados)
5. [Camada IPC](#5-camada-ipc)
6. [Interface Desktop (Renderer)](#6-interface-desktop-renderer)
7. [Aplicativo Mobile](#7-aplicativo-mobile)
8. [Pasta Shared](#8-pasta-shared)
9. [Bibliotecas e Dependências](#9-bibliotecas-e-dependências)
10. [Configuração de Build](#10-configuração-de-build)

---

## 1. Visão Geral da Arquitetura

O MoneyCapy é um aplicativo Electron com uma SPA React no renderer e um processo main responsável pelo banco de dados e lógica de negócio. A comunicação entre os dois processos usa o protocolo IPC do Electron. O app mobile em React Native compartilha o mesmo esquema de banco de dados e lógica de negócio, mas acessa o SQLite diretamente via `expo-sqlite`.

```
┌─────────────────────────────────┐
│         Electron Main           │  src/main/
│  ┌───────────┐ ┌─────────────┐  │
│  │ SQLite DB │ │ IPC Handlers│  │
│  └───────────┘ └─────────────┘  │
└────────────┬────────────────────┘
             │ IPC (window.api)
┌────────────▼────────────────────┐
│         React Renderer          │  src/renderer/
│  Pages → Contexts → Components  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│      React Native (Expo)        │  mobile/
│  Screens → Services → SQLite    │
└─────────────────────────────────┘
```

---

## 2. Estrutura de Pastas

```
MoneyCapy/
├── src/
│   ├── main/                    # Processo principal Electron
│   │   ├── index.ts             # Entry point: janela, tray, IPC, DB
│   │   ├── database/
│   │   │   ├── connection.ts    # Wrapper do sql.js
│   │   │   ├── migrations/      # 40 arquivos de migração SQL
│   │   │   │   └── runner.ts    # Executa migrações pendentes
│   │   │   └── repositories/   # 16 repositórios (acesso ao DB)
│   │   ├── ipc/                 # 15 arquivos de handlers IPC
│   │   │   └── register.ts     # Registra todos os handlers
│   │   ├── services/            # Lógica de negócio e integrações
│   │   └── utils/               # Utilitários (paths, month-utils)
│   ├── preload/
│   │   └── index.ts             # Expõe window.api para o renderer
│   └── renderer/
│       └── src/
│           ├── App.tsx          # Root com todos os providers
│           ├── pages/           # 11 páginas principais
│           ├── components/      # UI e layout
│           ├── contexts/        # 16 context providers
│           ├── hooks/           # 3 hooks customizados
│           ├── lib/             # Utilitários (currency, date, etc.)
│           ├── locales/         # pt-BR.json e en-US.json
│           └── types/           # TypeScript interfaces
├── mobile/                      # App React Native
│   ├── src/
│   │   ├── screens/             # 11 pastas de telas
│   │   ├── navigation/          # React Navigation setup
│   │   ├── contexts/            # Contexts do mobile
│   │   ├── services/            # 10 services (CRUD via SQLite)
│   │   ├── database/            # Mesmas 40 migrações + repos
│   │   ├── components/          # Componentes RN
│   │   ├── theme/               # Cores, espaçamento, tipografia
│   │   └── lib/                 # Utilitários
│   ├── app.json                 # Config Expo
│   └── package.json             # Dependências mobile
├── shared/                      # Tipos e lógica compartilhada
│   ├── ipc-channels.ts          # Constantes dos canais IPC
│   ├── dashboard-types.ts       # Tipos do dashboard
│   ├── insights-types.ts        # Tipos dos insights
│   └── day-utils.ts             # Cálculo de dia útil
├── resources/                   # Ícones e config do instalador
├── electron-builder.yml         # Config do build/instalador
├── electron.vite.config.ts      # Config do Vite
├── tailwind.config.ts           # Config do Tailwind
└── package.json                 # Dependências desktop
```

---

## 3. Processo Principal (Electron)

### `src/main/index.ts`
Entry point do app Electron. Responsável por:
- Criar a `BrowserWindow` com titlebar overlay (janela sem borda nativa)
- Gerenciar o ícone da bandeja do sistema (system tray)
- Garantir instância única do app (`app.requestSingleInstanceLock`)
- Inicializar o banco de dados SQLite e executar migrações
- Registrar todos os handlers IPC (`registerAllHandlers`)
- Iniciar o agendador de atualização de câmbio (`startAutoUpdateRates`)
- Configurar `ipcMain` para auto-start no login e minimizar para tray

### `src/main/database/connection.ts`
Wrapper sobre o `sql.js` que imita a API do `better-sqlite3`:
- `db.prepare(sql)` → retorna um statement com `.get()`, `.all()`, `.run()`
- `db.transaction(fn)` → executa função dentro de transação
- Carrega/salva o banco em disco em cada operação de escrita (sql.js é in-memory)
- O banco fica em `%APPDATA%/moneycapy/database.db` (produção) ou `data/database.db` (dev)

### `src/main/database/migrations/runner.ts`
Executa migrações progressivas:
- Mantém tabela `migrations` com `(id, name, applied_at)`
- Compara lista de arquivos `001_*.ts` … `040_*.ts` com registros aplicados
- Aplica somente as pendentes, em ordem numérica, dentro de uma transação

### Repositórios (`src/main/database/repositories/`)
Cada repositório encapsula o acesso SQL de uma entidade:

| Arquivo | Entidade | Métodos principais |
|---|---|---|
| `section-items.repo.ts` | Gastos | `listByMonth`, `create`, `update`, `delete`, `togglePaid`, `setMonthValue`, `interrupt`, `reactivate`, `anticipate` |
| `person-income.repo.ts` | Receitas | `listByMonth`, `create`, `update`, `delete`, `toggleReceived`, `setMonthValue`, `interrupt`, `reactivate` |
| `cards.repo.ts` | Cartões | `list`, `create`, `update`, `delete`, `listEnriched`, `payInvoice` |
| `bank-accounts.repo.ts` | Contas bancárias | `list`, `create`, `update`, `delete`, `listEnriched`, `setMonthlyBalance` |
| `categories.repo.ts` | Categorias | `list`, `create`, `update`, `delete` |
| `tags.repo.ts` | Tags | `list`, `create`, `update`, `delete` |
| `stores.repo.ts` | Lojas | `list`, `create`, `update`, `delete` |
| `people.repo.ts` | Pessoas | `list`, `create`, `update`, `delete` |
| `settings.repo.ts` | Configurações | `get`, `set`, `getAll` |
| `currencies.repo.ts` | Moedas | `list`, `create`, `update`, `delete`, `setBase`, `updateSnapshots` |
| `item-card-splits.repo.ts` | Splits de cartão | `listByItem`, `create`, `delete` |
| `item-monthly-status.repo.ts` | Status mensal de gastos | `get`, `set`, `remove` |
| `item-anticipations.repo.ts` | Antecipações | `list`, `create`, `delete` |
| `item-interruptions.repo.ts` | Interrupções de gastos | `list`, `create`, `delete` |
| `income-monthly-status.repo.ts` | Status mensal de receitas | `get`, `set`, `remove` |
| `income-interruptions.repo.ts` | Interrupções de receitas | `list`, `create`, `delete` |

### Serviços (`src/main/services/`)

| Arquivo | Função |
|---|---|
| `backup.service.ts` | Exporta/importa o banco completo; exporta CSV filtrado por período |
| `encryption.service.ts` | Criptografia AES-256-GCM para dados sensíveis de cartões |
| `frankfurter.service.ts` | Consulta a API pública [Frankfurter](https://www.frankfurter.app/) para cotações de câmbio |
| `holiday.service.ts` | Determina feriados para o cálculo de dias úteis |
| `auto-update-rates.ts` | Agendador que atualiza cotações automaticamente em background |

### `src/main/utils/paths.ts`
Define os caminhos do banco e backups:
- Produção: `%APPDATA%/moneycapy/`
- Dev: `./data/`

### `src/main/utils/month-utils.ts`
Utilitários de mês: operações de adição/subtração de meses no formato `YYYY-MM`, e resolução do tipo de cartão para período de cobrança.

---

## 4. Banco de Dados

O banco usa SQLite gerenciado via `sql.js`. O esquema evolui através de 40 migrações numeradas.

### Tabelas principais

#### `people`
Perfis de usuário. Toda entidade de dados tem `person_id` referenciando esta tabela.
```sql
id, name, created_at
```

#### `section_items` (gastos)
Tabela central de gastos. Tipos suportados:
- `common` — avulso
- `installment` — parcelado
- `subscription` — recorrente/assinatura
- `emprestimo` — empréstimo

Campos relevantes:
```sql
id, person_id, description, value, type,
start_month, end_month, installment_count, installment_index,
due_day, due_day_type, billing_close_day,
category_id, bank_account_id, store_id,
is_active, notes, interest_rate,
currency_id, exchange_rate_snapshot
```

`due_day_type` pode ser: `static`, `business_day`, `last_day`, `last_business_day`

#### `person_income` (receitas)
```sql
id, person_id, description, value,
is_recurring, start_month, end_month,
due_day, due_day_type,
category_id, store_id, notes,
currency_id, exchange_rate_snapshot
```

#### `cards` (cartões)
Dados sensíveis são criptografados com AES-256-GCM:
```sql
id, person_id, name, bank_account_id,
card_number_encrypted, card_expiry_encrypted, card_holder_encrypted,
credit_limit, billing_close_day, due_day,
card_type (credit | debit | both)
```

#### `bank_accounts` (contas bancárias)
```sql
id, person_id, name, nome_banco, account_type (corrente | poupanca),
juridicidade (cpf | cnpj), balance, icon, color
```

#### `categories`
```sql
id, person_id, name, icon, color
```

#### `tags`
```sql
id, person_id, name, color
```

#### `stores`
```sql
id, person_id, name, color
```

#### `currencies`
```sql
id, code, symbol, name, exchange_rate, is_base
```

#### `settings`
Tabela chave-valor para configurações do app:
```sql
key, value
```
Chaves usadas: `theme`, `language`, `date_format_order`, `date_format_separator`, `accent_color`, `password_hash`, `auto_start`, `minimize_to_tray`, etc.

### Tabelas de estado mensal

| Tabela | Função |
|---|---|
| `item_monthly_status` | Override de `is_paid` ou `is_active` por mês para um gasto |
| `item_monthly_values` | Override de valor de um gasto em mês específico |
| `item_interruptions` | Períodos de pausa de gastos (start_month, end_month) |
| `item_anticipations` | Registro de pagamento antecipado de uma parcela |
| `item_card_splits` | Divisão de gasto parcelado entre cartões |
| `income_monthly_status` | Override de `is_received` / valor por mês de uma receita |
| `income_monthly_values` | Override de valor de receita em mês específico |
| `income_interruptions` | Períodos de pausa de receitas |
| `income_tags` | Relação N:N entre receitas e tags |
| `item_tags` | Relação N:N entre gastos e tags |
| `bank_account_monthly_balance` | Saldo registrado manualmente por mês |

---

## 5. Camada IPC

A comunicação renderer ↔ main usa `ipcRenderer.invoke` / `ipcMain.handle`. O arquivo `src/preload/index.ts` expõe o objeto `window.api` com todos os métodos.

Os canais são definidos como constantes em `shared/ipc-channels.ts`.

### Handlers por domínio

#### `section-items.ipc.ts` — Gastos
| Canal | Descrição |
|---|---|
| `ITEMS_LIST` | Lista gastos de uma pessoa por mês, com dados enriquecidos |
| `ITEMS_CREATE` | Cria gasto (qualquer tipo) |
| `ITEMS_UPDATE` | Atualiza gasto |
| `ITEMS_DELETE` | Remove gasto e registros filhos |
| `ITEMS_TOGGLE_ACTIVE` | Ativa/desativa gasto |
| `ITEMS_TOGGLE_PAID` | Alterna status de pago no mês |
| `ITEMS_SET_PAID` | Define pago com data e hora |
| `ITEMS_INTERRUPT` | Pausa gasto por N meses |
| `ITEMS_REACTIVATE` | Retoma gasto pausado |
| `ITEMS_ANTICIPATE` | Registra pagamento antecipado |
| `ITEMS_UNDO_ANTICIPATION` | Desfaz antecipação |
| `ITEMS_SET_MONTH_VALUE` | Override de valor no mês |
| `ITEMS_REMOVE_MONTH_VALUE` | Remove override de valor |
| `ITEMS_SET_MONTHLY_ACTIVE` | Ativa/desativa no mês específico |
| `ITEMS_SEARCH` | Busca full-text com filtros |

#### `person-income.ipc.ts` — Receitas
| Canal | Descrição |
|---|---|
| `PERSON_INCOME_LIST_BY_MONTH` | Lista receitas do mês |
| `PERSON_INCOME_CREATE` | Cria receita |
| `PERSON_INCOME_UPDATE` | Atualiza receita |
| `PERSON_INCOME_DELETE` | Remove receita |
| `PERSON_INCOME_TOGGLE_RECEIVED` | Alterna status de recebida |
| `PERSON_INCOME_SET_RECEIVED` | Marca como recebida com data |
| `PERSON_INCOME_SET_MONTH_VALUE` | Override de valor no mês |
| `PERSON_INCOME_REMOVE_MONTH_VALUE` | Remove override |
| `PERSON_INCOME_SEARCH` | Busca com filtros |
| `INCOME_INTERRUPT` | Pausa receita |
| `INCOME_REACTIVATE` | Retoma receita |

#### `cards.ipc.ts` — Cartões
| Canal | Descrição |
|---|---|
| `CARDS_LIST` | Lista cartões com limite usado calculado |
| `CARDS_GET_DECRYPTED` | Descriptografa dados do cartão |
| `CARDS_CREATE` | Cria cartão (dados sensíveis criptografados) |
| `CARDS_UPDATE` | Atualiza cartão |
| `CARDS_DELETE` | Remove cartão |
| `CARDS_LIST_ENRICHED` | Lista com totais por tipo de gasto e mês |
| `CARDS_PAY_INVOICE` | Marca todos os gastos do mês como pagos |

#### `bank-accounts.ipc.ts` — Contas Bancárias
| Canal | Descrição |
|---|---|
| `BANK_ACCOUNTS_LIST` | Lista contas |
| `BANK_ACCOUNTS_CREATE` | Cria conta |
| `BANK_ACCOUNTS_UPDATE` | Atualiza conta |
| `BANK_ACCOUNTS_DELETE` | Remove conta |
| `BANK_ACCOUNTS_LIST_ENRICHED` | Lista com totais de gastos vinculados por mês |
| `BANK_ACCOUNTS_SET_MONTHLY_BALANCE` | Registra saldo mensal |
| `BANK_ACCOUNTS_REMOVE_MONTHLY_BALANCE` | Remove registro de saldo |

#### `categories.ipc.ts` / `tags.ipc.ts` / `stores.ipc.ts` / `people.ipc.ts`
CRUD padrão: `LIST`, `CREATE`, `UPDATE`, `DELETE` para cada entidade.

#### `settings.ipc.ts` — Configurações
| Canal | Descrição |
|---|---|
| `SETTINGS_GET` | Lê valor de uma configuração |
| `SETTINGS_SET` | Salva configuração |
| `SETTINGS_VERIFY_PASSWORD` | Verifica senha (bcrypt) |
| `SETTINGS_SET_PASSWORD` | Define nova senha |
| `SETTINGS_CHANGE_PASSWORD` | Altera senha existente |
| `SETTINGS_HAS_PASSWORD` | Verifica se senha está definida |
| `SETTINGS_RESET_PERSON` | Apaga todos os dados de um perfil |
| `SETTINGS_RESET_ALL_DATA` | Apaga todos os dados de todos os perfis |
| `SETTINGS_RESET_APP` | Reset total (factory reset) |

#### `currencies.ipc.ts` — Moedas
| Canal | Descrição |
|---|---|
| `CURRENCIES_LIST` | Lista moedas cadastradas |
| `CURRENCIES_GET_BASE` | Retorna moeda base |
| `CURRENCIES_CREATE/UPDATE/DELETE` | CRUD de moedas |
| `CURRENCIES_SET_BASE` | Define moeda base |
| `CURRENCIES_FETCH_RATES` | Busca cotações na API Frankfurter |
| `CURRENCIES_FETCH_AVAILABLE` | Lista moedas disponíveis na API |
| `CURRENCIES_UPDATE_SNAPSHOTS` | Atualiza snapshots de câmbio nos registros |
| `CURRENCIES_RESTART_AUTO_UPDATE` | Reinicia agendador de atualização |

#### `dashboard.ipc.ts` — Dashboard
| Canal | Descrição |
|---|---|
| `DASHBOARD_SUMMARY` | Resumo do mês: total gastos, receitas, saldo |
| `DASHBOARD_WIDGETS` | Dados para todos os widgets configurados |

#### `insights.ipc.ts` — Análises
| Canal | Descrição |
|---|---|
| `INSIGHTS_TEMPORAL` | Série temporal (diário/semanal/mensal/anual) |
| `INSIGHTS_COMPARATIVE` | Comparativo entre dois períodos |
| `INSIGHTS_PERIOD_DETAIL` | Lista de itens de um período específico |

#### `backup.ipc.ts` — Backup
| Canal | Descrição |
|---|---|
| `BACKUP_EXPORT` | Exporta banco completo como arquivo |
| `BACKUP_IMPORT` | Importa banco de arquivo |
| `BACKUP_EXPORT_CSV` | Exporta gastos/receitas em CSV |
| `BACKUP_EXPORT_FILTERED` | Exporta período filtrado |
| `APP_OPEN_DATA_FOLDER` | Abre pasta de dados no explorador |

---

## 6. Interface Desktop (Renderer)

### `src/renderer/src/App.tsx`
Raiz da aplicação. Empilha todos os context providers e renderiza as rotas com `react-router-dom` (hash routing).

### Roteamento
```
/           → Dashboard
/items      → Gastos
/accounts   → Contas Bancárias
/cards      → Cartões
/income     → Receitas
/people     → Pessoas
/categories → Categorias
/tags       → Tags
/stores     → Lojas
/insights   → Análises
/settings   → Configurações
```

### Páginas (`src/renderer/src/pages/`)

#### `dashboard/DashboardPage.tsx`
Grid de widgets com drag-and-drop (`@dnd-kit`). Widgets disponíveis: resumo do mês, cartões, contas bancárias, próximos vencimentos, top gastos, pendentes, distribuição, comparativos.

#### `items/ItemsPage.tsx`
Lista de gastos com busca, filtros (categoria, tag, conta, cartão, loja, status ativo/pago, forma de pagamento) e ordenação. Tab selector para tipo de gasto. Ações: criar, editar, pagar, antecipar, pausar, excluir.

#### `items/ItemsForm.tsx`
Formulário completo de gasto. Abas: detalhes, classificação, cartão. Suporte a splits de cartão (dividir parcelas entre múltiplos cartões), taxa de juros, mês de início/fim, notas.

#### `income/IncomePage.tsx`
Lista de receitas com filtros por tipo (recorrente/avulso), categorias e tags. Marcação de recebida, override de valor mensal, pausa e retomada.

#### `accounts/AccountsPage.tsx`
Lista de contas bancárias com totais de gastos por tipo no mês. Registro de saldo mensal. CRUD de contas.

#### `cards/CardsPage.tsx`
Lista de cartões com limite disponível/usado, total de gastos por tipo. Pagamento de fatura. Visualização de dados criptografados.

#### `categories/CategoriesPage.tsx`
CRUD de categorias com ícone e cor. Filtro por tipo de gasto (gastos vs receitas) e subtipo. Visualização de itens vinculados.

#### `tags/TagsPage.tsx`
CRUD de tags com cor. Mesma estrutura de filtros que categorias.

#### `stores/StoresPage.tsx`
CRUD de lojas/entidades com cor. Mesma estrutura de filtros.

#### `people/PeoplePage.tsx`
Gerenciamento de perfis. Criação, edição e exclusão de pessoas. Trocar perfil ativo.

#### `insights/InsightsPage.tsx`
Análises com gráficos Recharts. Série temporal configurável (escala e período), comparativo entre períodos, distribuição por categorias/tags/tipo de receita, lista detalhada de itens de um período.

#### `settings/SettingsPage.tsx`
Todas as configurações do app: tema, idioma, formato de data, moeda, cores por seção, dia útil, proteção por senha, auto-start, minimizar para tray, backup e reset de dados.

### Contexts (`src/renderer/src/contexts/`)

| Context | Estado gerenciado |
|---|---|
| `ActivePersonContext` | Pessoa ativa, lista de pessoas, versão de itens |
| `ThemeContext` | Tema light/dark, função toggleTheme |
| `LanguageContext` | Idioma, função `t(key, params)` para i18n |
| `CurrencySettingsContext` | Moedas, moeda base, config de formatação |
| `ColorSettingsContext` | Cores personalizadas por seção |
| `DateFormatContext` | Ordem (DMY/MDY/YMD) e separador de data |
| `DefaultMonthContext` | Offset do mês padrão |
| `StartCountingMonthContext` | Mês de início para analytics |
| `BusinessDayContext` | Config de dia útil (feriados, dias da semana) |
| `SessionContext` | Estado de sessão (senha, bloqueio) |
| `ToastPositionContext` | Posição das notificações toast |
| `AccentColorContext` | Cor de destaque do app |
| `ColorModeContext` | Modo de cor dos gráficos |
| `DimPaidContext` | Reduzir opacidade de itens pagos |
| `FilterDisplayModeContext` | Modo de exibição dos filtros (compact/primary-more/unified) |
| `TileFieldsContext` | Campos visíveis nos tiles de itens |

### Hooks (`src/renderer/src/hooks/`)

| Hook | Função |
|---|---|
| `useSortItems.ts` | Ordena lista de itens por vários critérios (nome, valor, vencimento, tipo) |
| `useSortOrder.ts` | Persiste preferência de ordem em `localStorage` |
| `useUndoableDelete.ts` | Delete com undo: exibe toast com janela de 5 segundos para desfazer |

### Utilitários (`src/renderer/src/lib/`)

| Arquivo | Função |
|---|---|
| `currency.ts` | `formatCurrency(value)` usando config global `setCurrencyConfig` |
| `date.ts` | `getCurrentMonth()`, `useFormatDate()` (formata com base no DateFormatContext) |
| `card-utils.ts` | Lógica de billing/due date para cartões |
| `colorUtils.ts` | Manipulação de cores (HSL, hex) |
| `insights-utils.ts` | Agregações e cálculos para os gráficos de insights |
| `constants.ts` | Cores preset, rotas (`ROUTES`), outras constantes |
| `sortOrder.ts` | Lógica de ordenação persistida |

### Componentes UI notáveis (`src/renderer/src/components/ui/`)

| Componente | Função |
|---|---|
| `FilterGroup.tsx` | Grupo de filtros com 3 modos: `compact` (todos inline, labels ocultados via `.filter-compact [data-filter-label] { display: none }`), `primary-more` (N inline + "Mais filtros" em popover), `unified` (botão único abre popover) |
| `FilterDropdown.tsx` | Dropdown com multi-seleção para filtros de categoria/tag/conta/etc. |
| `SimpleDropdown.tsx` | Dropdown de seleção única |
| `ColumnsPickerDropdown.tsx` | Seletor de número de colunas de grid |
| `TileFieldsPickerButton.tsx` | Botão olho para configurar campos visíveis nos tiles |
| `GlobalSearchModal.tsx` | Modal de busca global (Ctrl+K) |
| `KebabMenu.tsx` | Menu de contexto (⋮) |
| `MonthNavigator.tsx` | Navegador de mês com setas |
| `CurrencyInput.tsx` | Input com formatação de moeda em tempo real |
| `CurrencyTooltip.tsx` | Tooltip mostrando valor em outras moedas |
| `ColorPicker.tsx` / `IconPicker.tsx` | Seletores de cor e ícone |
| `ConfirmDialog.tsx` | Dialog de confirmação reutilizável |

### i18n (`src/renderer/src/locales/`)
Arquivos JSON com chaves em notação de pontos. Interpolação com `{{variavel}}`.

Namespaces: `items`, `itemsForm`, `itemTypes`, `income`, `accounts`, `cards`, `cardTypes`, `categories`, `tags`, `stores`, `people`, `insights`, `settings`, `sidebar`, `common`, `filters`, `sort`, `mobile.*`

Uso:
```ts
const { t } = useTranslation()
t('items.newItem')                  // "Novo gasto"
t('items.itemCount', { count: 3 }) // "3 gastos"
```

---

## 7. Aplicativo Mobile

### Framework e Ferramentas
- **React Native** via **Expo SDK 54**
- **TypeScript**
- **Metro bundler** (padrão Expo)
- Banco de dados: **expo-sqlite** (SQLite nativo)
- Criptografia: **expo-crypto** (AES-256-GCM)
- Sistema de arquivos: **expo-file-system**

### Navegação (`mobile/src/navigation/`)
Usa **React Navigation**:
```
RootNavigator
└── DrawerNavigator (Drawer + 11 stacks)
    ├── DrawerContent.tsx    # Painel do drawer com switcher de pessoa
    ├── HomeStack            → DashboardScreen
    ├── ItemsStack           → ItemsScreen, ItemFormScreen
    ├── IncomeStack          → IncomeScreen, IncomeFormScreen
    ├── AccountsStack        → AccountsScreen, AccountFormScreen
    ├── CardsStack           → CardsScreen, CardFormScreen
    ├── CategoriesStack      → CategoriesScreen
    ├── TagsStack            → TagsScreen
    ├── StoresStack          → StoresScreen
    ├── PeopleStack          → PeopleScreen
    ├── InsightsStack        → InsightsScreen
    └── SettingsStack        → SettingsScreen
```

### Telas (`mobile/src/screens/`)
Cada tela tem estrutura `ScreenContainer` com título e botão hamburger/voltar. Espelham as páginas do desktop com componentes React Native.

### Services (`mobile/src/services/`)
Equivalentes aos repositórios do desktop. Cada service recebe uma instância `WrappedDatabase` e executa queries SQL diretamente.

| Service | Entidade |
|---|---|
| `items.service.ts` | Gastos |
| `income.service.ts` | Receitas |
| `cards.service.ts` | Cartões |
| `bank-accounts.service.ts` | Contas bancárias |
| `categories.service.ts` | Categorias |
| `tags.service.ts` | Tags |
| `stores.service.ts` | Lojas |
| `people.service.ts` | Pessoas |
| `currencies.service.ts` | Moedas |
| `settings.service.ts` | Configurações |

### Banco de dados mobile (`mobile/src/database/`)
Mesmas 40 migrações do desktop. A conexão usa `expo-sqlite` com wrapper `WrappedDatabase` que imita a API do desktop.

### Tema (`mobile/src/theme/`)
```ts
useThemeColors()   // Retorna objeto de cores baseado no tema
spacing            // Espaçamentos: xs, sm, md, lg, xl, '2xl', '3xl'
borderRadius       // Raios: sm, md, lg, xl, full
typography         // Tamanhos e pesos de fonte
```

### Contexts mobile (`mobile/src/contexts/`)
| Context | Função |
|---|---|
| `DatabaseContext` | Conexão SQLite e status de inicialização |
| `ActivePersonContext` | Pessoa ativa, lista, troca de perfil |
| `LanguageContext` | i18n com função `t()` |
| `ThemeContext` | Tema light/dark |
| `AccentColorContext` | Cor de destaque |
| `SettingsContext` | Configurações gerais do app |
| `DrawerContext` | Estado de abertura do drawer |

---

## 8. Pasta Shared

Código compartilhado entre desktop e mobile.

### `shared/ipc-channels.ts`
Objeto `IPC_CHANNELS` com todas as constantes de canais IPC. Evita strings mágicas.
```ts
IPC_CHANNELS.ITEMS_LIST          // 'items:list'
IPC_CHANNELS.CARDS_PAY_INVOICE   // 'cards:pay-invoice'
```

### `shared/dashboard-types.ts`
Interfaces TypeScript para os dados retornados pelo dashboard:
- `DashboardMonthSummary` — totais do mês
- `DashboardCardEnriched` — cartão com totais por tipo
- `DashboardListItem` / `DashboardIncomeItem` — items para listas de próximos/pendentes
- Tipos de distribuição (por categoria, tag, tipo de receita)

### `shared/insights-types.ts`
Interfaces para dados de análise:
- `TimePoint` — ponto na série temporal (label, value, date)
- `InsightsTemporalResult` — resultado de série temporal com agrupamentos
- `InsightsComparativeResult` — resultado de comparativo entre períodos
- Tipos de agrupamento: `daily`, `weekly`, `monthly`, `yearly`

### `shared/day-utils.ts`
Lógica de resolução de dia útil:
- `DayType`: `static` | `business_day` | `last_day` | `last_business_day`
- `resolveDay(spec, month, config)` — retorna o dia efetivo considerando feriados e finais de semana
- Usado para calcular datas de vencimento de gastos e receitas

---

## 9. Bibliotecas e Dependências

### Desktop

| Biblioteca | Versão | Uso |
|---|---|---|
| `electron` | ^33.2.1 | Framework desktop (janela, tray, IPC, sistema) |
| `electron-vite` | ^2.3.0 | Build tool: compila main, preload e renderer com Vite |
| `electron-builder` | ^25.1.8 | Empacotamento e geração do instalador NSIS (.exe) |
| `react` + `react-dom` | ^18.3.1 | Interface de usuário |
| `react-router-dom` | ^7.1.0 | Roteamento client-side (hash routing) |
| `sql.js` | ^1.11.0 | SQLite compilado para WebAssembly; acesso ao banco no processo main |
| `@dnd-kit/core` + `sortable` | ^6.3.1 / ^10.0.0 | Drag-and-drop dos widgets do dashboard |
| `recharts` | ^2.15.0 | Gráficos SVG (barras, linhas, pizza, área) |
| `sonner` | ^1.7.0 | Notificações toast |
| `lucide-react` | ^0.468.0 | Biblioteca de ícones SVG |
| `tailwindcss` | ^3.4.17 | Estilização utilitária CSS |
| `typescript` | ^5.7.2 | Tipagem estática |
| `vite` | ^5.4.0 | Bundler para o renderer |

### Mobile

| Biblioteca | Versão | Uso |
|---|---|---|
| `expo` | ~54.0.0 | Framework mobile (build, APIs nativas) |
| `react-native` | 0.77.1 | UI nativa |
| `expo-sqlite` | ~15.1.4 | SQLite nativo no mobile |
| `expo-file-system` | ~18.1.10 | Acesso ao sistema de arquivos |
| `expo-crypto` | ~14.1.3 | Criptografia AES-256-GCM |
| `@react-navigation/native` | ^7.0.0 | Navegação base |
| `@react-navigation/drawer` | ^7.9.4 | Menu drawer lateral |
| `@react-navigation/native-stack` | ^7.0.0 | Stack de navegação nativo |
| `@react-navigation/bottom-tabs` | ^7.0.0 | Tabs inferiores |
| `react-native-gesture-handler` | ~2.24.0 | Gestos (swipe, drag) |
| `react-native-reanimated` | ~3.16.7 | Animações de alta performance |
| `react-native-toast-message` | ^2.2.0 | Notificações toast |
| `lucide-react-native` | ^0.475.0 | Ícones SVG para RN |

### API Externa

| API | Uso |
|---|---|
| [Frankfurter API](https://www.frankfurter.app/) | Cotações de câmbio em tempo real. Endpoint: `https://api.frankfurter.app/`. Gratuita, sem autenticação. |

---

## 10. Configuração de Build

### `electron-builder.yml`
```yaml
appId: com.moneycapy.app
productName: MoneyCapy
directories:
  buildResources: resources
  output: dist

win:
  icon: resources/icon.ico
  target: nsis       # Instalador NSIS para Windows

nsis:
  oneClick: false                      # Instalador assistido
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  include: resources/installer.nsh     # Script NSIS customizado
```

### `electron.vite.config.ts`
Configura três builds separados com Vite:
- **main**: Process principal Electron (Node.js, ESM)
- **preload**: Script de preload (CommonJS, acesso limitado)
- **renderer**: SPA React (browser, bundled)

### Scripts npm (`package.json`)
```bash
npm run dev        # Inicia em modo dev com hot reload
npm run build      # Build de produção (sem instalador)
npm run package    # Build + gera instalador .exe
npm run package:dir # Build + extrai sem instalador (para debug)
```

### Saída do build
```
out/
├── main/index.js         # Processo main compilado
├── preload/index.js      # Preload compilado
└── renderer/             # SPA React compilada

dist/
├── win-unpacked/         # App extraído
└── moneycapy-1.0.0-setup.exe  # Instalador final
```
