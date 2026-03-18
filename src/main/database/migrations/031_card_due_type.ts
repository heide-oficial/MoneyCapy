import { registerMigration } from './runner'

registerMigration({
  name: '031_card_due_type',
  up: (db) => {
    // Convert old offset=2 sentinel (meaning "card due") to proper card_due type
    // Old: due_day_type='static', due_day_month_offset=2 → resolved to next month
    // New: due_day_type='card_due', due_day_month_offset=1 (next month explicitly)
    db.exec(`UPDATE section_items SET due_day_type = 'card_due', due_day_month_offset = 1 WHERE due_day_month_offset = 2`)
  }
})
