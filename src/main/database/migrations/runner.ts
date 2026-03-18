import { WrappedDatabase } from '../connection'

interface Migration {
  name: string
  up: (db: WrappedDatabase) => void
}

const migrations: Migration[] = []

export function registerMigration(migration: Migration): void {
  migrations.push(migration)
}

export function runMigrations(db: WrappedDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = db
    .prepare('SELECT name FROM _migrations')
    .all()
    .map((row: any) => row.name)

  const pending = migrations.filter((m) => !applied.includes(m.name))

  for (const migration of pending) {
    console.log(`Running migration: ${migration.name}`)
    const run = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
    })
    run()
    console.log(`Migration applied: ${migration.name}`)
  }
}
