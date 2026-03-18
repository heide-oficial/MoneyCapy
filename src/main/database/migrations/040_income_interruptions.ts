import { registerMigration } from './runner'

registerMigration({
  name: '040_income_interruptions',
  up(db) {
    db.exec(`
      CREATE TABLE income_interruptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        income_id INTEGER NOT NULL REFERENCES person_income(id) ON DELETE CASCADE,
        end_month TEXT NOT NULL,
        resume_month TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_income_interruptions_income ON income_interruptions(income_id);
    `)
  }
})
