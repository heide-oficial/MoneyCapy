import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import initSqlJs from 'sql.js'
import { getDatabasePath, getBackupDir } from '../utils/paths'
import { WrappedDatabase } from '../database/connection'
import { CategoriesRepository } from '../database/repositories/categories.repo'
import { CardsRepository } from '../database/repositories/cards.repo'
import { PeopleRepository } from '../database/repositories/people.repo'
import { PersonIncomeRepository } from '../database/repositories/person-income.repo'
import { SectionItemsRepository } from '../database/repositories/section-items.repo'
import { TagsRepository } from '../database/repositories/tags.repo'

import { BankAccountsRepository } from '../database/repositories/bank-accounts.repo'

export class BackupService {
  constructor(private db: WrappedDatabase) {}

  exportBackup(destPath: string): boolean {
    const dir = dirname(destPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    // Force save in-memory DB to disk before copying
    this.db.forceSave()

    const dbPath = getDatabasePath()
    if (!existsSync(dbPath)) return false

    copyFileSync(dbPath, destPath)
    return true
  }

  importBackup(sourcePath: string): boolean {
    if (!existsSync(sourcePath)) return false

    const dbPath = getDatabasePath()
    const backupDir = getBackupDir()
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

    // Create automatic backup of current DB before overwriting
    if (existsSync(dbPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const autoBackup = `${backupDir}/pre-restore-${timestamp}.db`
      copyFileSync(dbPath, autoBackup)
    }

    copyFileSync(sourcePath, dbPath)
    return true
  }

  async exportFiltered(destPath: string, startMonth: string, endMonth: string): Promise<boolean> {
    const dir = dirname(destPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db.forceSave()

    const SQL = await initSqlJs()
    const newDb = new SQL.Database()

    // Get all CREATE TABLE/INDEX statements from the source
    const schemas = this.db.prepare(
      "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'index' THEN 2 ELSE 3 END"
    ).all() as { sql: string }[]

    for (const { sql } of schemas) {
      newDb.run(sql)
    }

    // Helper to copy a full table
    const copyTable = (table: string) => {
      const rows = this.db.prepare(`SELECT * FROM ${table}`).all()
      if (rows.length === 0) return
      const cols = Object.keys(rows[0])
      const placeholders = cols.map(() => '?').join(', ')
      const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      for (const row of rows) {
        newDb.run(insertSql, cols.map(c => (row as any)[c]))
      }
    }

    // Helper to copy rows from a query
    const copyQuery = (table: string, query: string, params: any[] = []) => {
      const rows = this.db.prepare(query).all(...params)
      if (rows.length === 0) return
      const cols = Object.keys(rows[0])
      const placeholders = cols.map(() => '?').join(', ')
      const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      for (const row of rows) {
        newDb.run(insertSql, cols.map(c => (row as any)[c]))
      }
    }

    // 1. Copy reference tables entirely
    const refTables = [
      '_migrations', 'settings', 'categories', 'tags', 'stores',
      'currencies', 'people', 'cards', 'bank_accounts', 'loans'
    ]
    for (const t of refTables) {
      try { copyTable(t) } catch { /* table may not exist */ }
    }

    // 2. Filter section_items by period overlap
    copyQuery(
      'section_items',
      `SELECT * FROM section_items WHERE start_month <= ? AND (end_month IS NULL OR end_month >= ?)`,
      [endMonth, startMonth]
    )

    // Get included item IDs for related tables
    const includedItems = this.db.prepare(
      `SELECT id FROM section_items WHERE start_month <= ? AND (end_month IS NULL OR end_month >= ?)`,
    ).all(endMonth, startMonth) as { id: number }[]
    const itemIds = includedItems.map(r => r.id)

    // 3. Filter person_income by period overlap
    copyQuery(
      'person_income',
      `SELECT * FROM person_income WHERE start_month <= ? AND (end_month IS NULL OR end_month >= ?)`,
      [endMonth, startMonth]
    )

    const includedIncomes = this.db.prepare(
      `SELECT id FROM person_income WHERE start_month <= ? AND (end_month IS NULL OR end_month >= ?)`,
    ).all(endMonth, startMonth) as { id: number }[]
    const incomeIds = includedIncomes.map(r => r.id)

    // 4. Copy monthly tables filtered by month range
    const monthlyTables = [
      'item_monthly_status', 'income_monthly_status',
      'item_monthly_values', 'item_monthly_active',
      'bank_account_monthly_balance'
    ]
    for (const t of monthlyTables) {
      try {
        copyQuery(t, `SELECT * FROM ${t} WHERE month >= ? AND month <= ?`, [startMonth, endMonth])
      } catch { /* table may not exist */ }
    }

    // 5. Copy item_tags and income_tags for included items/incomes
    if (itemIds.length > 0) {
      const itemChunks = this.chunkArray(itemIds, 500)
      for (const chunk of itemChunks) {
        const placeholders = chunk.map(() => '?').join(',')
        copyQuery('item_tags', `SELECT * FROM item_tags WHERE item_id IN (${placeholders})`, chunk)
      }
    }

    if (incomeIds.length > 0) {
      const incomeChunks = this.chunkArray(incomeIds, 500)
      for (const chunk of incomeChunks) {
        const placeholders = chunk.map(() => '?').join(',')
        try {
          copyQuery('income_tags', `SELECT * FROM income_tags WHERE income_id IN (${placeholders})`, chunk)
        } catch { /* table may not exist */ }
      }
    }

    // 6. Copy item_card_splits for included items
    if (itemIds.length > 0) {
      const itemChunks = this.chunkArray(itemIds, 500)
      for (const chunk of itemChunks) {
        const placeholders = chunk.map(() => '?').join(',')
        copyQuery('item_card_splits', `SELECT * FROM item_card_splits WHERE item_id IN (${placeholders})`, chunk)
      }
    }

    // 7. Copy item_anticipations filtered by month range
    try {
      copyQuery(
        'item_anticipations',
        `SELECT * FROM item_anticipations WHERE month >= ? AND month <= ?`,
        [startMonth, endMonth]
      )
    } catch { /* table may not exist */ }

    // 8. Copy interruptions for included items/incomes
    if (itemIds.length > 0) {
      const itemChunks = this.chunkArray(itemIds, 500)
      for (const chunk of itemChunks) {
        const placeholders = chunk.map(() => '?').join(',')
        try {
          copyQuery('item_interruptions', `SELECT * FROM item_interruptions WHERE item_id IN (${placeholders})`, chunk)
        } catch { /* table may not exist */ }
      }
    }

    if (incomeIds.length > 0) {
      const incomeChunks = this.chunkArray(incomeIds, 500)
      for (const chunk of incomeChunks) {
        const placeholders = chunk.map(() => '?').join(',')
        try {
          copyQuery('income_interruptions', `SELECT * FROM income_interruptions WHERE income_id IN (${placeholders})`, chunk)
        } catch { /* table may not exist */ }
      }
    }

    // Save the new database to disk
    const data = newDb.export()
    const buffer = Buffer.from(data)
    writeFileSync(destPath, buffer)
    newDb.close()

    return true
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size))
    }
    return chunks
  }

  exportCsv(destPath: string): boolean {
    const categories = new CategoriesRepository(this.db)
    const cards = new CardsRepository(this.db)
    const people = new PeopleRepository(this.db)
    const income = new PersonIncomeRepository(this.db)
    const sectionItems = new SectionItemsRepository(this.db)
    const tags = new TagsRepository(this.db)

    const bankAccountsRepo = new BankAccountsRepository(this.db)
    const dir = dirname(destPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const lines: string[] = []

    // Categories
    lines.push('=== CATEGORIAS ===')
    lines.push('ID;Nome;Icone;Cor')
    const cats = categories.findAll() as any[]
    for (const c of cats) {
      lines.push(`${c.id};${c.name};${c.icon};${c.color}`)
    }
    lines.push('')

    // People
    lines.push('=== PESSOAS ===')
    lines.push('ID;Nome;Cor')
    const allPeople = people.findAll() as any[]
    for (const p of allPeople) {
      lines.push(`${p.id};${p.name};${p.color}`)
    }
    lines.push('')

    // Items (by person, no sections)
    lines.push('=== ITENS ===')
    lines.push('ID;Pessoa;Descrição;Tipo;Valor;Dia Vencimento;Parcelas Totais;Mês Início;Mês Fim;Ativo;Notas;Categoria;Cartão;Ícone;Cor;Imagem;Loja')
    for (const p of allPeople) {
      const items = sectionItems.findAllByPerson(p.id) as any[]
      for (const item of items) {
        lines.push(`${item.id};${p.name};${item.description};${item.type};${item.value};${item.due_day || ''};${item.total_installments || ''};${item.start_month};${item.end_month || ''};${item.is_active};${item.notes || ''};${item.category_name || ''};${item.card_name || ''};${item.icon || ''};${item.color || ''};${item.image_url || ''};${item.store || ''}`)
      }
    }
    lines.push('')

    // Item Card Splits
    lines.push('=== DIVISÃO CARTÕES ===')
    lines.push('ID;Item ID;Cartão;Valor;Total Parcelas')
    const allSplits = this.db.prepare(`
      SELECT ics.*, c.name as card_name FROM item_card_splits ics
      LEFT JOIN cards c ON ics.card_id = c.id ORDER BY ics.item_id
    `).all() as any[]
    for (const s of allSplits) {
      lines.push(`${s.id};${s.item_id};${s.card_name || ''};${s.value};${s.total_installments}`)
    }
    lines.push('')

    // Tags
    lines.push('=== TAGS ===')
    lines.push('ID;Nome;Cor')
    const allTags = tags.findAll() as any[]
    for (const t of allTags) {
      lines.push(`${t.id};${t.name};${t.color}`)
    }
    lines.push('')

    // Item Tags
    lines.push('=== ITEM_TAGS ===')
    lines.push('Item ID;Tag ID')
    const itemTagRows = this.db.prepare('SELECT * FROM item_tags').all() as any[]
    for (const it of itemTagRows) {
      lines.push(`${it.item_id};${it.tag_id}`)
    }
    lines.push('')

    // Cards
    lines.push('=== CARTÕES ===')
    lines.push('ID;Nome;Pessoa;Limite Total;Dia Fechamento;Dia Vencimento')
    const allCards = cards.findAll() as any[]
    for (const c of allCards) {
      const personName = allPeople.find((p: any) => p.id === c.person_id)?.name || ''
      lines.push(`${c.id};${c.name};${personName};${c.total_limit};${c.billing_close_day};${c.due_day}`)
    }
    lines.push('')

    // Income
    lines.push('=== RECEITAS ===')
    lines.push('ID;Pessoa;Descrição;Valor;Recorrente')
    for (const p of allPeople) {
      const incomes = income.findByPersonId(p.id) as any[]
      for (const i of incomes) {
        lines.push(`${i.id};${p.name};${i.description};${i.value};${i.is_recurring}`)
      }
    }
    lines.push('')

    // Bank Accounts
    lines.push('=== CONTAS BANCÁRIAS ===')
    lines.push('ID;Pessoa;Nome;Saldo;Icone;Cor')
    for (const p of allPeople) {
      const accs = bankAccountsRepo.findByPersonId(p.id) as any[]
      for (const a of accs) {
        lines.push(`${a.id};${p.name};${a.name};${a.balance};${a.icon};${a.color}`)
      }
    }
    lines.push('')

    // Loans
    lines.push('=== EMPRÉSTIMOS ===')
    lines.push('ID;Pessoa;Descrição;Valor Total;Taxa Juros;Dia Vencimento;Total Parcelas;Parcelas Pagas;Valor Parcela;Notas')
    for (const p of allPeople) {
      const lns = this.db.prepare('SELECT * FROM loans WHERE person_id = ? ORDER BY description').all(p.id) as any[]
      for (const l of lns) {
        lines.push(`${l.id};${p.name};${l.description};${l.total_amount};${l.interest_rate};${l.due_day || ''};${l.total_installments};${l.paid_installments};${l.installment_value};${l.notes || ''}`)
      }
    }
    lines.push('')

    // Anticipations
    lines.push('=== ANTECIPAÇÕES ===')
    lines.push('ID;Item ID;Split ID;Mês;Quantidade')
    const allAnticipations = this.db.prepare(
      'SELECT * FROM item_anticipations ORDER BY item_id, month'
    ).all() as any[]
    for (const a of allAnticipations) {
      lines.push(`${a.id};${a.item_id};${a.split_id || ''};${a.month};${a.count}`)
    }
    lines.push('')

    // Interruptions
    lines.push('=== INTERRUPÇÕES ===')
    lines.push('ID;Item ID;Mês Fim;Mês Retorno')
    const allInterruptions = this.db.prepare(
      'SELECT * FROM item_interruptions ORDER BY item_id, end_month'
    ).all() as any[]
    for (const i of allInterruptions) {
      lines.push(`${i.id};${i.item_id};${i.end_month};${i.resume_month || ''}`)
    }
    lines.push('')

    // Income Interruptions
    lines.push('=== INTERRUPÇÕES RECEITAS ===')
    lines.push('ID;Income ID;Mês Fim;Mês Retorno')
    const allIncomeInterruptions = this.db.prepare(
      'SELECT * FROM income_interruptions ORDER BY income_id, end_month'
    ).all() as any[]
    for (const i of allIncomeInterruptions) {
      lines.push(`${i.id};${i.income_id};${i.end_month};${i.resume_month || ''}`)
    }
    lines.push('')

    writeFileSync(destPath, '\uFEFF' + lines.join('\n'), 'utf-8')
    return true
  }
}
