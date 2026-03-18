import { registerMigration } from './runner'

registerMigration({
  name: '039_item_interruptions',
  up(db) {
    db.exec(`
      CREATE TABLE item_interruptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        end_month TEXT NOT NULL,
        resume_month TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_item_interruptions_item ON item_interruptions(item_id);
    `)

    // Migrate existing interrupted items to new table
    db.exec(`
      INSERT INTO item_interruptions (item_id, end_month, resume_month)
      SELECT id, end_month, resume_month FROM section_items
      WHERE end_reason = 'interrupted' AND end_month IS NOT NULL;

      UPDATE section_items SET end_month = NULL, end_reason = NULL, resume_month = NULL
      WHERE end_reason = 'interrupted';
    `)
  }
})
