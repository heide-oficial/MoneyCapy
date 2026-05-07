import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AppUpdateInfo } from '../../shared/app-info'
import type {
  CategoryCreateInput,
  CategoryRecord,
  CategoryUpdateInput,
  PersonCreateInput,
  PersonRecord,
  PersonUpdateInput,
  StoreCreateInput,
  StoreRecord,
  StoreUpdateInput,
  SubcategoryCreateInput,
  SubcategoryRecord,
  SubcategoryUpdateInput,
  TagCreateInput,
  TagRecord,
  TagUpdateInput
} from '../../shared/api-types'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

const api = {
  cards: {
    list: (personId?: number, month?: string) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_LIST, personId, month),
    listEnriched: (personId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_LIST_ENRICHED, personId, month),
    getDecrypted: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_GET_DECRYPTED, id),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_CREATE, data),
    update: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_UPDATE, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_DELETE, id),
    payInvoice: (cardId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.CARDS_PAY_INVOICE, cardId, month)
  },
  categories: {
    list: () => invoke<CategoryRecord[]>(IPC_CHANNELS.CATEGORIES_LIST),
    create: (data: CategoryCreateInput) => invoke<CategoryRecord>(IPC_CHANNELS.CATEGORIES_CREATE, data),
    update: (data: CategoryUpdateInput) => invoke<CategoryRecord>(IPC_CHANNELS.CATEGORIES_UPDATE, data),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.CATEGORIES_DELETE, id)
  },
  subcategories: {
    list: () => invoke<SubcategoryRecord[]>(IPC_CHANNELS.SUBCATEGORIES_LIST),
    create: (data: SubcategoryCreateInput) => invoke<SubcategoryRecord>(IPC_CHANNELS.SUBCATEGORIES_CREATE, data),
    update: (data: SubcategoryUpdateInput) => invoke<SubcategoryRecord>(IPC_CHANNELS.SUBCATEGORIES_UPDATE, data),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.SUBCATEGORIES_DELETE, id)
  },
  people: {
    list: () => invoke<PersonRecord[]>(IPC_CHANNELS.PEOPLE_LIST),
    create: (data: PersonCreateInput) => invoke<PersonRecord>(IPC_CHANNELS.PEOPLE_CREATE, data),
    update: (data: PersonUpdateInput) => invoke<PersonRecord>(IPC_CHANNELS.PEOPLE_UPDATE, data),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.PEOPLE_DELETE, id)
  },
  personIncome: {
    listByMonth: (personId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_LIST_BY_MONTH, personId, month),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_CREATE, data),
    update: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_UPDATE, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_DELETE, id),
    toggleReceived: (incomeId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_TOGGLE_RECEIVED, incomeId, month),
    setReceived: (incomeId: number, month: string, isReceived: boolean, receivedAt?: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_SET_RECEIVED, incomeId, month, isReceived, receivedAt),
    setMonthValue: (incomeId: number, month: string, value: number) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_SET_MONTH_VALUE, incomeId, month, value),
    removeMonthValue: (incomeId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_REMOVE_MONTH_VALUE, incomeId, month),
    listMonthValues: (incomeId: number) => ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_LIST_MONTH_VALUES, incomeId),
    search: (personId: number, query: string, filters?: { isRecurring?: boolean; categoryId?: number; tagId?: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PERSON_INCOME_SEARCH, personId, query, filters),
    interrupt: (incomeId: number, month: string, pauseMonths?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.INCOME_INTERRUPT, incomeId, month, pauseMonths),
    reactivate: (interruptionId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.INCOME_REACTIVATE, interruptionId)
  },
  items: {
    list: (personId: number, month: string, typeFilter?: string) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_LIST, personId, month, typeFilter),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_CREATE, data),
    update: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_UPDATE, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_DELETE, id),
    toggleActive: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_TOGGLE_ACTIVE, id),
    togglePaid: (id: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_TOGGLE_PAID, id, month),
    setPaid: (id: number, month: string, isPaid: boolean, paidAt?: string) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_SET_PAID, id, month, isPaid, paidAt),
    interrupt: (itemId: number, month: string, pauseMonths?: number) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_INTERRUPT, itemId, month, pauseMonths),
    reactivate: (interruptionId: number) => ipcRenderer.invoke(IPC_CHANNELS.ITEMS_REACTIVATE, interruptionId),
    anticipate: (itemId: number, month: string, count: number, splitId?: number, discountedTotal?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_ANTICIPATE, itemId, month, count, splitId, discountedTotal),
    undoAnticipation: (anticipationId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_UNDO_ANTICIPATION, anticipationId),
    setMonthValue: (itemId: number, month: string, value: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_SET_MONTH_VALUE, itemId, month, value),
    removeMonthValue: (itemId: number, month: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_REMOVE_MONTH_VALUE, itemId, month),
    listMonthValues: (itemId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_LIST_MONTH_VALUES, itemId),
    setMonthlyActive: (itemId: number, month: string, isActive: boolean | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_SET_MONTHLY_ACTIVE, itemId, month, isActive),
    search: (personId: number, query: string, filters?: { type?: string; categoryId?: number; storeId?: number; cardId?: number; tagId?: number; isPaid?: boolean; isActive?: boolean; bankAccountId?: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.ITEMS_SEARCH, personId, query, filters)
  },
  stores: {
    list: () => invoke<StoreRecord[]>(IPC_CHANNELS.STORES_LIST),
    create: (data: StoreCreateInput) => invoke<StoreRecord>(IPC_CHANNELS.STORES_CREATE, data),
    update: (data: StoreUpdateInput) => invoke<StoreRecord>(IPC_CHANNELS.STORES_UPDATE, data),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.STORES_DELETE, id)
  },
  tags: {
    list: () => invoke<TagRecord[]>(IPC_CHANNELS.TAGS_LIST),
    create: (data: TagCreateInput) => invoke<TagRecord>(IPC_CHANNELS.TAGS_CREATE, data),
    update: (data: TagUpdateInput) => invoke<TagRecord>(IPC_CHANNELS.TAGS_UPDATE, data),
    delete: (id: number) => invoke<void>(IPC_CHANNELS.TAGS_DELETE, id)
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
    verifyPassword: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_VERIFY_PASSWORD, password),
    setPassword: (password: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_PASSWORD, password),
    changePassword: (currentPassword: string, newPassword: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHANGE_PASSWORD, currentPassword, newPassword),
    hasPassword: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_HAS_PASSWORD),
    resetPerson: (personId: number) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET_PERSON, personId),
    resetAllData: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET_ALL_DATA),
    resetApp: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET_APP)
  },
  bankAccounts: {
    list: (personId: number) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_LIST, personId),
    listEnriched: (personId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_LIST_ENRICHED, personId, month),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_CREATE, data),
    update: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_UPDATE, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_DELETE, id),
    setMonthlyBalance: (bankAccountId: number, month: string, balance: number) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_SET_MONTHLY_BALANCE, bankAccountId, month, balance),
    removeMonthlyBalance: (bankAccountId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.BANK_ACCOUNTS_REMOVE_MONTHLY_BALANCE, bankAccountId, month)
  },
  dashboard: {
    summary: (personId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_SUMMARY, personId, month),
    widgets: (personId: number, month: string) => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_WIDGETS, personId, month)
  },
  insights: {
    temporal: (personId: number, grouping: string, startDate: string, endDate: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_TEMPORAL, personId, grouping, startDate, endDate),
    comparative: (personId: number, granularity: string, periodA: string, periodB: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_COMPARATIVE, personId, granularity, periodA, periodB),
    periodDetail: (personId: number, startDate: string, endDate: string, categoryId?: number | null, tagId?: number | null, filterType?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.INSIGHTS_PERIOD_DETAIL, personId, startDate, endDate, categoryId, tagId, filterType)
  },
  currencies: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_LIST),
    getBase: () => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_GET_BASE),
    create: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_CREATE, data),
    update: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_UPDATE, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_DELETE, id),
    setBase: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_SET_BASE, id),
    fetchRates: (baseCode?: string, forceRefresh?: boolean) => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_FETCH_RATES, baseCode, forceRefresh),
    fetchAvailable: () => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_FETCH_AVAILABLE),
    updateSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_UPDATE_SNAPSHOTS),
    restartAutoUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.CURRENCIES_RESTART_AUTO_UPDATE),
    onCurrenciesUpdated: (cb: () => void) => {
      const listener = () => cb()
      ipcRenderer.on('currencies-updated', listener)
      return () => { ipcRenderer.removeListener('currencies-updated', listener) }
    }
  },
  backup: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_IMPORT),
    exportCsv: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT_CSV),
    exportFiltered: (startMonth: string, endMonth: string) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT_FILTERED, startMonth, endMonth),
    openDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_DATA_FOLDER)
  },
  app: {
    setAutoStart: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_AUTO_START, enabled),
    setMinimizeToTray: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.APP_SET_MINIMIZE_TO_TRAY, enabled),
    checkForUpdates: () => invoke<AppUpdateInfo>(IPC_CHANNELS.APP_CHECK_FOR_UPDATES),
    openExternal: (url: string) => invoke<boolean>(IPC_CHANNELS.APP_OPEN_EXTERNAL, url),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.APP_RELAUNCH)
  }
}

export type ApiType = typeof api

contextBridge.exposeInMainWorld('api', api)
