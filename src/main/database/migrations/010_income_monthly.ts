import { registerMigration } from './runner'

registerMigration({
  name: '010_income_monthly',
  up(db) {
    // Add start_month and end_month to person_income
    db.exec(`ALTER TABLE person_income ADD COLUMN start_month TEXT NOT NULL DEFAULT ''`)
    db.exec(`ALTER TABLE person_income ADD COLUMN end_month TEXT`)

    // Fill start_month for existing records with current month
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    db.prepare(`UPDATE person_income SET start_month = ? WHERE start_month = ''`).run(currentMonth)

    // Per-month value overrides (base value in person_income.value, overrides here)
    db.exec(`
      CREATE TABLE income_monthly_values (
        income_id INTEGER NOT NULL REFERENCES person_income(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        value REAL NOT NULL,
        PRIMARY KEY (income_id, month)
      )
    `)

    // Per-month received status
    db.exec(`
      CREATE TABLE income_monthly_status (
        income_id INTEGER NOT NULL REFERENCES person_income(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        is_received INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (income_id, month)
      )
    `)

    db.exec(`CREATE INDEX idx_income_monthly_values_month ON income_monthly_values(month)`)
    db.exec(`CREATE INDEX idx_income_monthly_status_month ON income_monthly_status(month)`)
  }
})
