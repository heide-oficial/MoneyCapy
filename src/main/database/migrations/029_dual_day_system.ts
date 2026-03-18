import { registerMigration } from './runner'

registerMigration({
  name: '029_dual_day_system',
  up: (db) => {
    // section_items: add day type columns and billing day columns
    db.exec(`ALTER TABLE section_items ADD COLUMN due_day_type TEXT DEFAULT 'static'`)
    db.exec(`ALTER TABLE section_items ADD COLUMN billing_day INTEGER`)
    db.exec(`ALTER TABLE section_items ADD COLUMN billing_day_type TEXT DEFAULT 'static'`)

    // Migrate existing data: if due_day_label = 'cobranca', move due_day -> billing_day
    db.exec(`
      UPDATE section_items
      SET billing_day = due_day,
          billing_day_type = 'static',
          due_day = NULL,
          due_day_type = 'static'
      WHERE due_day_label = 'cobranca'
    `)

    // person_income: add due day columns
    db.exec(`ALTER TABLE person_income ADD COLUMN due_day INTEGER`)
    db.exec(`ALTER TABLE person_income ADD COLUMN due_day_type TEXT DEFAULT 'static'`)
  }
})
