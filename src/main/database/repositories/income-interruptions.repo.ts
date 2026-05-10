import { WrappedDatabase } from '../connection'

export class IncomeInterruptionsRepository {
  constructor(private db: WrappedDatabase) {}

  findByIncomeId(incomeId: number): { id: number; income_id: number; end_month: string; resume_month: string | null; created_at: string }[] {
    return this.db.prepare(
      'SELECT * FROM income_interruptions WHERE income_id = ? ORDER BY end_month ASC'
    ).all(incomeId) as any[]
  }

  create(incomeId: number, endMonth: string, resumeMonth?: string | null): void {
    this.db.prepare(
      'INSERT INTO income_interruptions (income_id, end_month, resume_month) VALUES (?, ?, ?)'
    ).run(incomeId, endMonth, resumeMonth ?? null)
  }

  updateById(id: number, endMonth: string, resumeMonth?: string | null): void {
    this.db.prepare(
      'UPDATE income_interruptions SET end_month = ?, resume_month = ? WHERE id = ?'
    ).run(endMonth, resumeMonth ?? null, id)
  }

  deleteById(id: number): void {
    this.db.prepare('DELETE FROM income_interruptions WHERE id = ?').run(id)
  }

  hasPermanent(incomeId: number): boolean {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM income_interruptions WHERE income_id = ? AND resume_month IS NULL'
    ).get(incomeId) as any
    return row.cnt > 0
  }
}
