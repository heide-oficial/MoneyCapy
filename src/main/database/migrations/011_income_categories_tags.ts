import { registerMigration } from './runner'

registerMigration({
  name: '011_income_categories_tags',
  up(db) {
    db.exec(`ALTER TABLE person_income ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL`)

    db.exec(`
      CREATE TABLE income_tags (
        income_id INTEGER NOT NULL REFERENCES person_income(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (income_id, tag_id)
      )
    `)
    db.exec(`CREATE INDEX idx_income_tags_tag_id ON income_tags(tag_id)`)
  }
})
