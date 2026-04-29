export const IPC_CHANNELS = {
  // Cards
  CARDS_LIST: 'cards:list',
  CARDS_GET_DECRYPTED: 'cards:get-decrypted',
  CARDS_CREATE: 'cards:create',
  CARDS_UPDATE: 'cards:update',
  CARDS_DELETE: 'cards:delete',
  CARDS_LIST_ENRICHED: 'cards:list-enriched',
  CARDS_PAY_INVOICE: 'cards:pay-invoice',

  // Categories
  CATEGORIES_LIST: 'categories:list',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  // Subcategories
  SUBCATEGORIES_LIST: 'subcategories:list',
  SUBCATEGORIES_CREATE: 'subcategories:create',
  SUBCATEGORIES_UPDATE: 'subcategories:update',
  SUBCATEGORIES_DELETE: 'subcategories:delete',

  // People
  PEOPLE_LIST: 'people:list',
  PEOPLE_CREATE: 'people:create',
  PEOPLE_UPDATE: 'people:update',
  PEOPLE_DELETE: 'people:delete',

  // Person Income
  PERSON_INCOME_LIST_BY_MONTH: 'person-income:list-by-month',
  PERSON_INCOME_CREATE: 'person-income:create',
  PERSON_INCOME_UPDATE: 'person-income:update',
  PERSON_INCOME_DELETE: 'person-income:delete',
  PERSON_INCOME_TOGGLE_RECEIVED: 'person-income:toggle-received',
  PERSON_INCOME_SET_RECEIVED: 'person-income:set-received',
  PERSON_INCOME_SET_MONTH_VALUE: 'person-income:set-month-value',
  PERSON_INCOME_REMOVE_MONTH_VALUE: 'person-income:remove-month-value',
  PERSON_INCOME_LIST_MONTH_VALUES: 'person-income:list-month-values',
  PERSON_INCOME_SEARCH: 'person-income:search',
  INCOME_INTERRUPT: 'income:interrupt',
  INCOME_REACTIVATE: 'income:reactivate',

  // Items (replaces Sections + Section Items)
  ITEMS_LIST: 'items:list',
  ITEMS_CREATE: 'items:create',
  ITEMS_UPDATE: 'items:update',
  ITEMS_DELETE: 'items:delete',
  ITEMS_TOGGLE_ACTIVE: 'items:toggle-active',
  ITEMS_TOGGLE_PAID: 'items:toggle-paid',
  ITEMS_SET_PAID: 'items:set-paid',
  ITEMS_INTERRUPT: 'items:interrupt',
  ITEMS_REACTIVATE: 'items:reactivate',
  ITEMS_ANTICIPATE: 'items:anticipate',
  ITEMS_UNDO_ANTICIPATION: 'items:undo-anticipation',
  ITEMS_SET_MONTH_VALUE: 'items:set-month-value',
  ITEMS_REMOVE_MONTH_VALUE: 'items:remove-month-value',
  ITEMS_LIST_MONTH_VALUES: 'items:list-month-values',
  ITEMS_SET_MONTHLY_ACTIVE: 'items:set-monthly-active',
  ITEMS_SEARCH: 'items:search',

  // Stores
  STORES_LIST: 'stores:list',
  STORES_CREATE: 'stores:create',
  STORES_UPDATE: 'stores:update',
  STORES_DELETE: 'stores:delete',

  // Tags
  TAGS_LIST: 'tags:list',
  TAGS_CREATE: 'tags:create',
  TAGS_UPDATE: 'tags:update',
  TAGS_DELETE: 'tags:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_VERIFY_PASSWORD: 'settings:verify-password',
  SETTINGS_SET_PASSWORD: 'settings:set-password',
  SETTINGS_CHANGE_PASSWORD: 'settings:change-password',
  SETTINGS_HAS_PASSWORD: 'settings:has-password',
  SETTINGS_RESET_PERSON: 'settings:reset-person',
  SETTINGS_RESET_ALL_DATA: 'settings:reset-all-data',
  SETTINGS_RESET_APP: 'settings:reset-app',

  // Bank Accounts
  BANK_ACCOUNTS_LIST: 'bank-accounts:list',
  BANK_ACCOUNTS_CREATE: 'bank-accounts:create',
  BANK_ACCOUNTS_UPDATE: 'bank-accounts:update',
  BANK_ACCOUNTS_DELETE: 'bank-accounts:delete',
  BANK_ACCOUNTS_LIST_ENRICHED: 'bank-accounts:list-enriched',
  BANK_ACCOUNTS_SET_MONTHLY_BALANCE: 'bank-accounts:set-monthly-balance',
  BANK_ACCOUNTS_REMOVE_MONTHLY_BALANCE: 'bank-accounts:remove-monthly-balance',

  // Dashboard
  DASHBOARD_SUMMARY: 'dashboard:summary',
  DASHBOARD_WIDGETS: 'dashboard:widgets',

  // Insights
  INSIGHTS_TEMPORAL: 'insights:temporal',
  INSIGHTS_COMPARATIVE: 'insights:comparative',
  INSIGHTS_PERIOD_DETAIL: 'insights:period-detail',

  // Currencies
  CURRENCIES_LIST: 'currencies:list',
  CURRENCIES_GET_BASE: 'currencies:get-base',
  CURRENCIES_CREATE: 'currencies:create',
  CURRENCIES_UPDATE: 'currencies:update',
  CURRENCIES_DELETE: 'currencies:delete',
  CURRENCIES_SET_BASE: 'currencies:set-base',
  CURRENCIES_FETCH_RATES: 'currencies:fetch-rates',
  CURRENCIES_FETCH_AVAILABLE: 'currencies:fetch-available',
  CURRENCIES_UPDATE_SNAPSHOTS: 'currencies:update-snapshots',
  CURRENCIES_RESTART_AUTO_UPDATE: 'currencies:restart-auto-update',

  // Backup
  BACKUP_EXPORT: 'backup:export',
  BACKUP_IMPORT: 'backup:import',
  BACKUP_EXPORT_CSV: 'backup:export-csv',
  BACKUP_EXPORT_FILTERED: 'backup:export-filtered',
  APP_OPEN_DATA_FOLDER: 'app:open-data-folder',

  // App
  APP_SET_AUTO_START: 'app:set-auto-start',
  APP_SET_MINIMIZE_TO_TRAY: 'app:set-minimize-to-tray',
  APP_RELAUNCH: 'app:relaunch',
} as const
