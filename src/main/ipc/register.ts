import { WrappedDatabase } from '../database/connection'
import { registerSettingsHandlers } from './settings.ipc'
import { registerCategoriesHandlers } from './categories.ipc'
import { registerSubcategoriesHandlers } from './subcategories.ipc'
import { registerCardsHandlers } from './cards.ipc'
import { registerPeopleHandlers } from './people.ipc'
import { registerPersonIncomeHandlers } from './person-income.ipc'
import { registerSectionItemsHandlers } from './section-items.ipc'
import { registerTagsHandlers } from './tags.ipc'
import { registerStoresHandlers } from './stores.ipc'

import { registerDashboardHandlers } from './dashboard.ipc'
import { registerBackupHandlers } from './backup.ipc'
import { registerBankAccountsHandlers } from './bank-accounts.ipc'
import { registerInsightsHandlers } from './insights.ipc'
import { registerCurrenciesHandlers } from './currencies.ipc'

export function registerAllIpcHandlers(db: WrappedDatabase): void {
  registerSettingsHandlers(db)
  registerCategoriesHandlers(db)
  registerSubcategoriesHandlers(db)
  registerCardsHandlers(db)
  registerPeopleHandlers(db)
  registerPersonIncomeHandlers(db)
  registerSectionItemsHandlers(db)
  registerTagsHandlers(db)
  registerStoresHandlers(db)

  registerDashboardHandlers(db)
  registerBackupHandlers(db)
  registerBankAccountsHandlers(db)
  registerInsightsHandlers(db)
  registerCurrenciesHandlers(db)
}
