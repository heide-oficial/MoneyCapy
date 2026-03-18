import { registerMigration } from './runner'

registerMigration({
  name: '016_anticipations_split_id',
  up(db) {
    // Check if split_id column already exists (migration 015 may have been created with it)
    const cols = db.prepare(
      "SELECT name FROM pragma_table_info('item_anticipations')"
    ).all() as any[]
    const hasColumn = cols.some((c: any) => c.name === 'split_id')

    if (!hasColumn) {
      db.exec(`
        ALTER TABLE item_anticipations ADD COLUMN split_id INTEGER REFERENCES item_card_splits(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_anticipations_split ON item_anticipations(split_id);
      `)
    }
  }
})
