import { registerMigration } from './runner'

registerMigration({
  name: '015_item_anticipations',
  up(db) {
    db.exec(`
      CREATE TABLE item_anticipations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES section_items(id) ON DELETE CASCADE,
        split_id INTEGER REFERENCES item_card_splits(id) ON DELETE CASCADE,
        month TEXT NOT NULL,
        count INTEGER NOT NULL CHECK(count > 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX idx_anticipations_item ON item_anticipations(item_id);
      CREATE INDEX idx_anticipations_split ON item_anticipations(split_id);
    `)
  }
})
