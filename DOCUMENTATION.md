# MoneyCapy — Technical Documentation

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Electron Main Process](#3-electron-main-process)
4. [Database](#4-database)
5. [IPC Layer](#5-ipc-layer)
6. [Desktop UI (Renderer)](#6-desktop-ui-renderer)
7. [Shared Folder](#7-shared-folder)
8. [Libraries & Dependencies](#8-libraries--dependencies)
9. [Build Configuration](#9-build-configuration)

---

## 1. Architecture Overview

MoneyCapy is an Electron application with a React SPA in the renderer process and a main process responsible for the database and business logic. Communication between the two processes uses Electron's IPC protocol.

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
```

---

## 2. Folder Structure

```
MoneyCapy/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # Entry point: window, tray, IPC, DB
│   │   ├── database/
│   │   │   ├── connection.ts    # sql.js wrapper
│   │   │   ├── migrations/      # 40 migration files
│   │   │   │   └── runner.ts    # Runs pending migrations
│   │   │   └── repositories/   # 16 repositories (DB access)
│   │   ├── ipc/                 # 15 IPC handler files
│   │   │   └── register.ts     # Registers all handlers
│   │   ├── services/            # Business logic and integrations
│   │   └── utils/               # Utilities (paths, month-utils)
│   ├── preload/
│   │   └── index.ts             # Exposes window.api to renderer
│   └── renderer/
│       └── src/
│           ├── App.tsx          # Root with all providers
│           ├── pages/           # 11 main pages
│           ├── components/      # UI and layout components
│           ├── contexts/        # 16 context providers
│           ├── hooks/           # 3 custom hooks
│           ├── lib/             # Utilities (currency, date, etc.)
│           ├── locales/         # pt-BR.json and en-US.json
│           └── types/           # TypeScript interfaces
├── shared/                      # Shared types and logic
│   ├── ipc-channels.ts          # IPC channel constants
│   ├── dashboard-types.ts       # Dashboard data types
│   ├── insights-types.ts        # Insights calculation types
│   └── day-utils.ts             # Business day resolution logic
├── resources/                   # Icons and installer config
├── electron-builder.yml         # Build configuration
├── electron.vite.config.ts      # Vite config
├── tailwind.config.ts           # Tailwind config
└── package.json                 # Dependencies
```

---

## 3. Electron Main Process

### `src/main/index.ts`
Application entry point. Responsible for:
- Creating the `BrowserWindow` with titlebar overlay (frameless native window)
- Managing the system tray icon (minimize to tray)
- Enforcing single instance lock (`app.requestSingleInstanceLock`)
- Initializing the SQLite database and running migrations
- Registering all IPC handlers (`registerAllHandlers`)
- Starting the currency exchange rate auto-update scheduler (`startAutoUpdateRates`)
- Configuring `ipcMain` for auto-start on login and minimize to tray

### `src/main/database/connection.ts`
Wrapper over `sql.js` that mimics the `better-sqlite3` API:
- `db.prepare(sql)` → returns a statement with `.get()`, `.all()`, `.run()`
- `db.transaction(fn)` → executes a function inside a transaction
- Loads/saves the database to disk on each write operation (sql.js is in-memory)
- Database path: `%APPDATA%/moneycapy/database.db` (production) or `data/database.db` (dev)

### `src/main/database/migrations/runner.ts`
Executes progressive migrations:
- Maintains a `migrations` table with `(id, name, applied_at)`
- Compares the list of `001_*.ts` … `040_*.ts` files against applied records
- Applies only pending ones, in numeric order, inside a transaction

### Repositories (`src/main/database/repositories/`)
Each repository encapsulates the SQL access for one entity:

| File | Entity | Key Methods |
|---|---|---|
| `section-items.repo.ts` | Expenses | `listByMonth`, `create`, `update`, `delete`, `togglePaid`, `setMonthValue`, `interrupt`, `reactivate`, `anticipate` |
| `person-income.repo.ts` | Income | `listByMonth`, `create`, `update`, `delete`, `toggleReceived`, `setMonthValue`, `interrupt`, `reactivate` |
| `cards.repo.ts` | Cards | `list`, `create`, `update`, `delete`, `listEnriched`, `payInvoice` |
| `bank-accounts.repo.ts` | Bank Accounts | `list`, `create`, `update`, `delete`, `listEnriched`, `setMonthlyBalance` |
| `categories.repo.ts` | Categories | `list`, `create`, `update`, `delete` |
| `tags.repo.ts` | Tags | `list`, `create`, `update`, `delete` |
| `stores.repo.ts` | Stores | `list`, `create`, `update`, `delete` |
| `people.repo.ts` | People | `list`, `create`, `update`, `delete` |
| `settings.repo.ts` | Settings | `get`, `set`, `getAll` |
| `currencies.repo.ts` | Currencies | `list`, `create`, `update`, `delete`, `setBase`, `updateSnapshots` |
| `item-card-splits.repo.ts` | Card Splits | `listByItem`, `create`, `delete` |
| `item-monthly-status.repo.ts` | Monthly Expense Status | `get`, `set`, `remove` |
| `item-anticipations.repo.ts` | Anticipations | `list`, `create`, `delete` |
| `item-interruptions.repo.ts` | Expense Interruptions | `list`, `create`, `delete` |
| `income-monthly-status.repo.ts` | Monthly Income Status | `get`, `set`, `remove` |
| `income-interruptions.repo.ts` | Income Interruptions | `list`, `create`, `delete` |

### Services (`src/main/services/`)

| File | Purpose |
|---|---|
| `backup.service.ts` | Exports/imports the full database; exports filtered CSV by period |
| `encryption.service.ts` | AES-256-GCM encryption for sensitive card data |
| `frankfurter.service.ts` | Queries the public [Frankfurter API](https://www.frankfurter.app/) for exchange rates |
| `holiday.service.ts` | Determines holidays for business day calculation |
| `auto-update-rates.ts` | Scheduler that automatically updates exchange rates in the background |

### `src/main/utils/paths.ts`
Defines database and backup paths:
- Production: `%APPDATA%/moneycapy/`
- Dev: `./data/`

### `src/main/utils/month-utils.ts`
Month utilities: add/subtract months in `YYYY-MM` format, and resolve card type for billing period.

---

## 4. Database

The database uses SQLite managed via `sql.js`. The schema evolves through 40 numbered migrations.

### Core Tables

#### `people`
User profiles. Every data entity has a `person_id` referencing this table.
```sql
id, name, created_at
```

#### `section_items` (expenses)
Central expenses table. Supported types:
- `common` — one-time
- `installment` — installment-based
- `subscription` — recurring/subscription
- `emprestimo` — loan

Key fields:
```sql
id, person_id, description, value, type,
start_month, end_month, installment_count, installment_index,
due_day, due_day_type, billing_close_day,
category_id, bank_account_id, store_id,
is_active, notes, interest_rate,
currency_id, exchange_rate_snapshot
```

`due_day_type` values: `static`, `business_day`, `last_day`, `last_business_day`

#### `person_income` (income)
```sql
id, person_id, description, value,
is_recurring, start_month, end_month,
due_day, due_day_type,
category_id, store_id, notes,
currency_id, exchange_rate_snapshot
```

#### `cards` (credit cards)
Sensitive data is encrypted with AES-256-GCM:
```sql
id, person_id, name, bank_account_id,
card_number_encrypted, card_expiry_encrypted, card_holder_encrypted,
credit_limit, billing_close_day, due_day,
card_type (credit | debit | both)
```

#### `bank_accounts`
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
Key-value table for app configuration:
```sql
key, value
```
Keys used: `theme`, `language`, `date_format_order`, `date_format_separator`, `accent_color`, `password_hash`, `auto_start`, `minimize_to_tray`, etc.

### Monthly State Tables

| Table | Purpose |
|---|---|
| `item_monthly_status` | Override `is_paid` or `is_active` per month for an expense |
| `item_monthly_values` | Override the value of an expense in a specific month |
| `item_interruptions` | Expense pause periods (start_month, end_month) |
| `item_anticipations` | Early payment records for installments |
| `item_card_splits` | Split an installment expense across multiple cards |
| `income_monthly_status` | Override `is_received` / value per month for income |
| `income_monthly_values` | Override income value in a specific month |
| `income_interruptions` | Income pause periods |
| `income_tags` | N:N relationship between income and tags |
| `item_tags` | N:N relationship between expenses and tags |
| `bank_account_monthly_balance` | Manually recorded balance per month |

---

## 5. IPC Layer

Renderer ↔ main communication uses `ipcRenderer.invoke` / `ipcMain.handle`. The file `src/preload/index.ts` exposes the `window.api` object with all methods.

Channels are defined as constants in `shared/ipc-channels.ts`.

### Handlers by Domain

#### `section-items.ipc.ts` — Expenses
| Channel | Description |
|---|---|
| `ITEMS_LIST` | List expenses for a person by month, with enriched data |
| `ITEMS_CREATE` | Create expense (any type) |
| `ITEMS_UPDATE` | Update expense |
| `ITEMS_DELETE` | Delete expense and child records |
| `ITEMS_TOGGLE_ACTIVE` | Enable/disable expense |
| `ITEMS_TOGGLE_PAID` | Toggle paid status for the month |
| `ITEMS_SET_PAID` | Set paid with date and time |
| `ITEMS_INTERRUPT` | Pause expense for N months |
| `ITEMS_REACTIVATE` | Resume paused expense |
| `ITEMS_ANTICIPATE` | Record early payment |
| `ITEMS_UNDO_ANTICIPATION` | Undo early payment |
| `ITEMS_SET_MONTH_VALUE` | Override value for the month |
| `ITEMS_REMOVE_MONTH_VALUE` | Remove value override |
| `ITEMS_SET_MONTHLY_ACTIVE` | Enable/disable for a specific month |
| `ITEMS_SEARCH` | Full-text search with filters |

#### `person-income.ipc.ts` — Income
| Channel | Description |
|---|---|
| `PERSON_INCOME_LIST_BY_MONTH` | List income for the month |
| `PERSON_INCOME_CREATE` | Create income |
| `PERSON_INCOME_UPDATE` | Update income |
| `PERSON_INCOME_DELETE` | Delete income |
| `PERSON_INCOME_TOGGLE_RECEIVED` | Toggle received status |
| `PERSON_INCOME_SET_RECEIVED` | Mark as received with date |
| `PERSON_INCOME_SET_MONTH_VALUE` | Override value for the month |
| `PERSON_INCOME_REMOVE_MONTH_VALUE` | Remove override |
| `PERSON_INCOME_SEARCH` | Search with filters |
| `INCOME_INTERRUPT` | Pause income |
| `INCOME_REACTIVATE` | Resume income |

#### `cards.ipc.ts` — Credit Cards
| Channel | Description |
|---|---|
| `CARDS_LIST` | List cards with calculated used limit |
| `CARDS_GET_DECRYPTED` | Decrypt card details |
| `CARDS_CREATE` | Create card (sensitive data encrypted) |
| `CARDS_UPDATE` | Update card |
| `CARDS_DELETE` | Delete card |
| `CARDS_LIST_ENRICHED` | List with totals per expense type per month |
| `CARDS_PAY_INVOICE` | Mark all expenses for the month as paid |

#### `bank-accounts.ipc.ts` — Bank Accounts
| Channel | Description |
|---|---|
| `BANK_ACCOUNTS_LIST` | List accounts |
| `BANK_ACCOUNTS_CREATE` | Create account |
| `BANK_ACCOUNTS_UPDATE` | Update account |
| `BANK_ACCOUNTS_DELETE` | Delete account |
| `BANK_ACCOUNTS_LIST_ENRICHED` | List with linked expense totals per month |
| `BANK_ACCOUNTS_SET_MONTHLY_BALANCE` | Record monthly balance |
| `BANK_ACCOUNTS_REMOVE_MONTHLY_BALANCE` | Remove balance record |

#### `categories.ipc.ts` / `tags.ipc.ts` / `stores.ipc.ts` / `people.ipc.ts`
Standard CRUD: `LIST`, `CREATE`, `UPDATE`, `DELETE` for each entity.

#### `settings.ipc.ts` — Settings
| Channel | Description |
|---|---|
| `SETTINGS_GET` | Read a setting value |
| `SETTINGS_SET` | Save a setting |
| `SETTINGS_VERIFY_PASSWORD` | Verify password (bcrypt) |
| `SETTINGS_SET_PASSWORD` | Set new password |
| `SETTINGS_CHANGE_PASSWORD` | Change existing password |
| `SETTINGS_HAS_PASSWORD` | Check if password is set |
| `SETTINGS_RESET_PERSON` | Delete all data for a profile |
| `SETTINGS_RESET_ALL_DATA` | Wipe all data for all profiles |
| `SETTINGS_RESET_APP` | Full factory reset |

#### `currencies.ipc.ts` — Currencies
| Channel | Description |
|---|---|
| `CURRENCIES_LIST` | List registered currencies |
| `CURRENCIES_GET_BASE` | Get base currency |
| `CURRENCIES_CREATE/UPDATE/DELETE` | Currency CRUD |
| `CURRENCIES_SET_BASE` | Set base currency |
| `CURRENCIES_FETCH_RATES` | Fetch rates from Frankfurter API |
| `CURRENCIES_FETCH_AVAILABLE` | List available currencies from API |
| `CURRENCIES_UPDATE_SNAPSHOTS` | Update exchange rate snapshots on records |
| `CURRENCIES_RESTART_AUTO_UPDATE` | Restart update scheduler |

#### `dashboard.ipc.ts` — Dashboard
| Channel | Description |
|---|---|
| `DASHBOARD_SUMMARY` | Monthly summary: total expenses, income, balance |
| `DASHBOARD_WIDGETS` | Data for all configured widgets |

#### `insights.ipc.ts` — Analytics
| Channel | Description |
|---|---|
| `INSIGHTS_TEMPORAL` | Time series (daily/weekly/monthly/yearly) |
| `INSIGHTS_COMPARATIVE` | Comparison between two periods |
| `INSIGHTS_PERIOD_DETAIL` | Item list for a specific period |

#### `backup.ipc.ts` — Backup
| Channel | Description |
|---|---|
| `BACKUP_EXPORT` | Export full database as file |
| `BACKUP_IMPORT` | Import database from file |
| `BACKUP_EXPORT_CSV` | Export expenses/income as CSV |
| `BACKUP_EXPORT_FILTERED` | Export filtered period |
| `APP_OPEN_DATA_FOLDER` | Open data folder in file explorer |

---

## 6. Desktop UI (Renderer)

### `src/renderer/src/App.tsx`
Application root. Stacks all context providers and renders routes via `react-router-dom` (hash routing).

### Routing
```
/           → Dashboard
/items      → Expenses
/accounts   → Bank Accounts
/cards      → Credit Cards
/income     → Income
/people     → People
/categories → Categories
/tags       → Tags
/stores     → Stores
/insights   → Analytics
/settings   → Settings
```

### Pages (`src/renderer/src/pages/`)

#### `dashboard/DashboardPage.tsx`
Widget grid with drag-and-drop (`@dnd-kit`). Available widgets: monthly summary, cards, bank accounts, upcoming due dates, top expenses, pending items, distribution, comparatives.

#### `items/ItemsPage.tsx`
Expense list with search, filters (category, tag, account, card, store, active/paid status, payment method) and sorting. Tab selector for expense type. Actions: create, edit, pay, anticipate, pause, delete.

#### `items/ItemsForm.tsx`
Full expense form. Tabs: details, classification, card. Supports card splits (split installments across multiple cards), interest rate, start/end month, notes.

#### `income/IncomePage.tsx`
Income list with filters by type (recurring/one-time), categories, and tags. Mark as received, monthly value override, pause and resume.

#### `accounts/AccountsPage.tsx`
Bank account list with expense totals per type for the month. Monthly balance recording. Account CRUD.

#### `cards/CardsPage.tsx`
Card list with available/used limit, expense totals per type. Invoice payment. View encrypted card data.

#### `categories/CategoriesPage.tsx`
Category CRUD with icon and color. Filter by expense type (expenses vs income) and subtype. View linked items.

#### `tags/TagsPage.tsx`
Tag CRUD with color. Same filter structure as categories.

#### `stores/StoresPage.tsx`
Store CRUD with color. Same filter structure.

#### `people/PeoplePage.tsx`
Profile management. Create, edit, and delete people. Switch active profile.

#### `insights/InsightsPage.tsx`
Analytics with Recharts charts. Configurable time series (scale and period), period comparison, distribution by categories/tags/income type, detailed item list for a period.

#### `settings/SettingsPage.tsx`
All app settings: theme, language, date format, currency, colors per section, business day, password protection, auto-start, minimize to tray, backup, and data reset.

### Contexts (`src/renderer/src/contexts/`)

| Context | Managed State |
|---|---|
| `ActivePersonContext` | Active person, people list, items version counter |
| `ThemeContext` | Light/dark theme, toggleTheme function |
| `LanguageContext` | Language, `t(key, params)` function for i18n |
| `CurrencySettingsContext` | Currencies, base currency, formatting config |
| `ColorSettingsContext` | Custom colors per section |
| `DateFormatContext` | Order (DMY/MDY/YMD) and date separator |
| `DefaultMonthContext` | Default month offset |
| `StartCountingMonthContext` | Start month for analytics |
| `BusinessDayContext` | Business day config (holidays, weekdays) |
| `SessionContext` | Session state (password, lock) |
| `ToastPositionContext` | Toast notification position |
| `AccentColorContext` | App accent color |
| `ColorModeContext` | Chart color mode |
| `DimPaidContext` | Reduce opacity of paid items |
| `FilterDisplayModeContext` | Filter display mode (compact / primary-more / unified) |
| `TileFieldsContext` | Visible fields in item tiles |

### Hooks (`src/renderer/src/hooks/`)

| Hook | Purpose |
|---|---|
| `useSortItems.ts` | Sort item list by various criteria (name, value, due date, type) |
| `useSortOrder.ts` | Persist sort preference in `localStorage` |
| `useUndoableDelete.ts` | Delete with undo: shows toast with 5-second window to undo |

### Utilities (`src/renderer/src/lib/`)

| File | Purpose |
|---|---|
| `currency.ts` | `formatCurrency(value)` using global config set by `setCurrencyConfig` |
| `date.ts` | `getCurrentMonth()`, `useFormatDate()` (formats based on DateFormatContext) |
| `card-utils.ts` | Billing/due date logic for cards |
| `colorUtils.ts` | Color manipulation (HSL, hex) |
| `insights-utils.ts` | Aggregations and calculations for analytics charts |
| `constants.ts` | Preset colors, routes (`ROUTES`), other constants |
| `sortOrder.ts` | Persisted sort order logic |

### Notable UI Components (`src/renderer/src/components/ui/`)

| Component | Purpose |
|---|---|
| `FilterGroup.tsx` | Filter group with 3 modes: `compact` (all inline, labels hidden via `.filter-compact [data-filter-label] { display: none }`), `primary-more` (N inline + "More filters" popover), `unified` (single button opens popover) |
| `FilterDropdown.tsx` | Multi-select dropdown for category/tag/account filters |
| `SimpleDropdown.tsx` | Single-select dropdown |
| `ColumnsPickerDropdown.tsx` | Grid column count selector |
| `TileFieldsPickerButton.tsx` | Eye icon button to configure visible fields in tiles |
| `GlobalSearchModal.tsx` | Global search modal (Ctrl+K) |
| `KebabMenu.tsx` | Context menu (⋮) |
| `MonthNavigator.tsx` | Month navigator with arrows |
| `CurrencyInput.tsx` | Input with real-time currency formatting |
| `CurrencyTooltip.tsx` | Tooltip showing value in other currencies |
| `ColorPicker.tsx` / `IconPicker.tsx` | Color and icon selectors |
| `ConfirmDialog.tsx` | Reusable confirmation dialog |

### i18n (`src/renderer/src/locales/`)
JSON files with dot-notation keys. Interpolation with `{{variable}}`.

Namespaces: `items`, `itemsForm`, `itemTypes`, `income`, `accounts`, `cards`, `cardTypes`, `categories`, `tags`, `stores`, `people`, `insights`, `settings`, `sidebar`, `common`, `filters`, `sort`

Usage:
```ts
const { t } = useTranslation()
t('items.newItem')                  // "New expense"
t('items.itemCount', { count: 3 }) // "3 expenses"
```

---

## 7. Shared Folder

Code shared between processes.

### `shared/ipc-channels.ts`
`IPC_CHANNELS` object with all channel constants. Avoids magic strings.
```ts
IPC_CHANNELS.ITEMS_LIST          // 'items:list'
IPC_CHANNELS.CARDS_PAY_INVOICE   // 'cards:pay-invoice'
```

### `shared/dashboard-types.ts`
TypeScript interfaces for dashboard data:
- `DashboardMonthSummary` — monthly totals
- `DashboardCardEnriched` — card with totals per type
- `DashboardListItem` / `DashboardIncomeItem` — items for upcoming/pending lists
- Distribution entry types (by category, tag, income type)

### `shared/insights-types.ts`
Interfaces for analytics data:
- `TimePoint` — point in a time series (label, value, date)
- `InsightsTemporalResult` — time series result with groupings
- `InsightsComparativeResult` — period comparison result
- Grouping types: `daily`, `weekly`, `monthly`, `yearly`

### `shared/day-utils.ts`
Business day resolution logic:
- `DayType`: `static` | `business_day` | `last_day` | `last_business_day`
- `resolveDay(spec, month, config)` — returns the effective day accounting for holidays and weekends
- Used to calculate due dates for expenses and income

---

## 8. Libraries & Dependencies

| Library | Version | Purpose |
|---|---|---|
| `electron` | ^33.2.1 | Desktop framework (window, tray, IPC, system) |
| `electron-vite` | ^2.3.0 | Build tool: compiles main, preload, and renderer with Vite |
| `electron-builder` | ^25.1.8 | Packaging and NSIS installer generation (.exe) |
| `react` + `react-dom` | ^18.3.1 | User interface |
| `react-router-dom` | ^7.1.0 | Client-side routing (hash routing) |
| `sql.js` | ^1.11.0 | SQLite compiled to WebAssembly; database access in main process |
| `@dnd-kit/core` + `sortable` | ^6.3.1 / ^10.0.0 | Dashboard widget drag-and-drop |
| `recharts` | ^2.15.0 | SVG charts (bar, line, pie, area) |
| `sonner` | ^1.7.0 | Toast notifications |
| `lucide-react` | ^0.468.0 | SVG icon library |
| `tailwindcss` | ^3.4.17 | Utility-first CSS styling |
| `typescript` | ^5.7.2 | Static typing |
| `vite` | ^5.4.0 | Renderer bundler |

### External API

| API | Purpose |
|---|---|
| [Frankfurter API](https://www.frankfurter.app/) | Real-time exchange rates. Endpoint: `https://api.frankfurter.app/`. Free, no authentication required. |

---

## 9. Build Configuration

### `electron-builder.yml`
```yaml
appId: com.moneycapy.app
productName: MoneyCapy
directories:
  buildResources: resources
  output: dist

win:
  icon: resources/icon.ico
  target: nsis       # NSIS installer for Windows

nsis:
  oneClick: false                      # Assisted installer
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  include: resources/installer.nsh     # Custom NSIS script
```

### `electron.vite.config.ts`
Configures three separate Vite builds:
- **main**: Electron main process (Node.js, ESM)
- **preload**: Preload script (CommonJS, restricted access)
- **renderer**: React SPA (browser, bundled)

### npm Scripts (`package.json`)
```bash
npm run dev        # Start in dev mode with hot reload
npm run build      # Production build (no installer)
npm run package    # Build + generate .exe installer
npm run package:dir # Build + extract without installer (for debugging)
```

### Build Output
```
out/
├── main/index.js         # Compiled main process
├── preload/index.js      # Compiled preload
└── renderer/             # Compiled React SPA

dist/
├── win-unpacked/         # Extracted app
└── moneycapy-1.0.0-setup.exe  # Final installer
```
