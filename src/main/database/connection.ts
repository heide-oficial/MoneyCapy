import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { getDatabasePath } from '../utils/paths'

let db: SqlJsDatabase | null = null
let dbPath: string = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null
let wrappedDb: WrappedDatabase | null = null

// Wrapper to provide a better-sqlite3-like API over sql.js
export interface Statement {
  run(...params: any[]): { changes: number; lastInsertRowid: number }
  get(...params: any[]): any
  all(...params: any[]): any[]
}

export interface WrappedDatabase {
  prepare(sql: string): Statement
  exec(sql: string): void
  transaction<T>(fn: () => T): () => T
  pragma(pragma: string): void
  close(): void
  forceSave(): void
}

function saveToDisk(): void {
  if (!db || !dbPath) return
  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
  } catch (err) {
    console.error('Failed to save database:', err)
  }
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveToDisk, 300)
}

function createWrapper(sqlDb: SqlJsDatabase): WrappedDatabase {
  return {
    prepare(sql: string): Statement {
      return {
        run(...params: any[]) {
          sqlDb.run(sql, params)
          const changes = sqlDb.getRowsModified()
          const res = sqlDb.exec('SELECT last_insert_rowid() as id')
          const lastId = (res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0) as number
          scheduleSave()
          return { changes, lastInsertRowid: lastId }
        },
        get(...params: any[]) {
          const stmt = sqlDb.prepare(sql)
          if (params.length > 0) stmt.bind(params)
          if (stmt.step()) {
            const cols = stmt.getColumnNames()
            const vals = stmt.get()
            stmt.free()
            const row: any = {}
            cols.forEach((col, i) => { row[col] = vals[i] })
            return row
          }
          stmt.free()
          return undefined
        },
        all(...params: any[]) {
          const stmt = sqlDb.prepare(sql)
          if (params.length > 0) stmt.bind(params)
          const results: any[] = []
          const cols = stmt.getColumnNames()
          while (stmt.step()) {
            const vals = stmt.get()
            const row: any = {}
            cols.forEach((col, i) => { row[col] = vals[i] })
            results.push(row)
          }
          stmt.free()
          return results
        }
      }
    },
    exec(sql: string) {
      sqlDb.exec(sql)
      scheduleSave()
    },
    transaction<T>(fn: () => T): () => T {
      return () => {
        sqlDb.run('BEGIN TRANSACTION')
        try {
          const result = fn()
          sqlDb.run('COMMIT')
          scheduleSave()
          return result
        } catch (err) {
          sqlDb.run('ROLLBACK')
          throw err
        }
      }
    },
    pragma(pragma: string) {
      try { sqlDb.run(`PRAGMA ${pragma}`) } catch { /* ignore unsupported pragmas */ }
    },
    forceSave() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      saveToDisk()
    },
    close() {
      if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
      }
      saveToDisk()
      sqlDb.close()
    }
  }
}

export async function initDatabase(): Promise<WrappedDatabase> {
  if (wrappedDb) return wrappedDb

  const SQL = await initSqlJs()
  dbPath = getDatabasePath()

  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')

  wrappedDb = createWrapper(db)
  return wrappedDb
}

export function getWrappedDatabase(): WrappedDatabase {
  if (!wrappedDb) throw new Error('Database not initialized. Call initDatabase() first.')
  return wrappedDb
}

export function closeDatabase(): void {
  if (wrappedDb) {
    wrappedDb.close()
    wrappedDb = null
    db = null
  }
}
