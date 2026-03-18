import { registerMigration } from './runner'

registerMigration({
  name: '037_multi_currency',
  up(db) {
    db.exec(`
      CREATE TABLE currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        exchange_rate REAL NOT NULL DEFAULT 1.0,
        is_base INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)

    db.exec(`ALTER TABLE section_items ADD COLUMN currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL`)
    db.exec(`ALTER TABLE section_items ADD COLUMN exchange_rate_snapshot REAL NOT NULL DEFAULT 1.0`)

    db.exec(`ALTER TABLE person_income ADD COLUMN currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL`)
    db.exec(`ALTER TABLE person_income ADD COLUMN exchange_rate_snapshot REAL NOT NULL DEFAULT 1.0`)

    db.exec(`ALTER TABLE cards ADD COLUMN currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL`)
    db.exec(`ALTER TABLE bank_accounts ADD COLUMN currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL`)

    // Seed base currency from existing currencySettings
    const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'currencySettings'").get() as any
    let code = 'BRL'
    let name = 'Real Brasileiro'
    let symbol = 'R$'

    if (settingsRow && settingsRow.value) {
      try {
        const parsed = JSON.parse(settingsRow.value)
        if (parsed.symbol) {
          symbol = parsed.symbol
          const symbolMap: Record<string, { code: string; name: string }> = {
            'R$': { code: 'BRL', name: 'Real Brasileiro' },
            '$': { code: 'USD', name: 'US Dollar' },
            'US$': { code: 'USD', name: 'US Dollar' },
            '\u20AC': { code: 'EUR', name: 'Euro' },
            '\u00A3': { code: 'GBP', name: 'British Pound' },
            '\u00A5': { code: 'JPY', name: 'Japanese Yen' },
            'CA$': { code: 'CAD', name: 'Canadian Dollar' },
            'A$': { code: 'AUD', name: 'Australian Dollar' },
            'CHF': { code: 'CHF', name: 'Swiss Franc' },
            '\u20B9': { code: 'INR', name: 'Indian Rupee' },
            'MX$': { code: 'MXN', name: 'Mexican Peso' },
            'AR$': { code: 'ARS', name: 'Argentine Peso' },
            'CL$': { code: 'CLP', name: 'Chilean Peso' },
            'CO$': { code: 'COP', name: 'Colombian Peso' },
            'S/.': { code: 'PEN', name: 'Peruvian Sol' },
            '\u20A9': { code: 'KRW', name: 'South Korean Won' },
            'kr': { code: 'SEK', name: 'Swedish Krona' },
            'z\u0142': { code: 'PLN', name: 'Polish Zloty' },
            '\u20BA': { code: 'TRY', name: 'Turkish Lira' }
          }
          const match = symbolMap[symbol]
          if (match) {
            code = match.code
            name = match.name
          }
        }
      } catch { /* use defaults */ }
    }

    db.prepare(
      `INSERT INTO currencies (code, name, symbol, exchange_rate, is_base) VALUES (?, ?, ?, 1.0, 1)`
    ).run(code, name, symbol)

    // Update all existing records to use the base currency
    db.exec(`UPDATE section_items SET currency_id = 1, exchange_rate_snapshot = 1.0`)
    db.exec(`UPDATE person_income SET currency_id = 1, exchange_rate_snapshot = 1.0`)
    db.exec(`UPDATE cards SET currency_id = 1`)
    db.exec(`UPDATE bank_accounts SET currency_id = 1`)
  }
})
