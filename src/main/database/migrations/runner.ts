import { WrappedDatabase } from '../connection'

interface Migration {
  name: string
  up: (db: WrappedDatabase) => void
}

export interface MigrationProgress {
  current: number
  total: number
  name: string
  status: 'running' | 'applied'
}

interface RunMigrationsOptions {
  onProgress?: (progress: MigrationProgress) => void
}

const migrations: Migration[] = []

export function registerMigration(migration: Migration): void {
  migrations.push(migration)
}

function ensureMigrationsTable(db: WrappedDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export function getPendingMigrations(db: WrappedDatabase): string[] {
  ensureMigrationsTable(db)
  const applied = db
    .prepare('SELECT name FROM _migrations')
    .all()
    .map((row: any) => row.name)

  return migrations.filter((m) => !applied.includes(m.name)).map((migration) => migration.name)
}

export function runMigrations(db: WrappedDatabase, options: RunMigrationsOptions = {}): void {
  ensureMigrationsTable(db)

  const pendingNames = getPendingMigrations(db)
  const pending = migrations.filter((m) => pendingNames.includes(m.name))

  pending.forEach((migration, index) => {
    options.onProgress?.({
      current: index,
      total: pending.length,
      name: migration.name,
      status: 'running'
    })
    console.log(`Running migration: ${migration.name}`)
    const run = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
    })
    run()
    console.log(`Migration applied: ${migration.name}`)
    options.onProgress?.({
      current: index + 1,
      total: pending.length,
      name: migration.name,
      status: 'applied'
    })
  })
}
