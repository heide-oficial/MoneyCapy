import { WrappedDatabase } from '../connection'

export class ItemInterruptionsRepository {
  constructor(private db: WrappedDatabase) {}

  findByItemId(itemId: number): { id: number; item_id: number; end_month: string; resume_month: string | null; created_at: string }[] {
    return this.db.prepare(
      'SELECT * FROM item_interruptions WHERE item_id = ? ORDER BY end_month ASC'
    ).all(itemId) as any[]
  }

  create(itemId: number, endMonth: string, resumeMonth?: string): void {
    this.db.prepare(
      'INSERT INTO item_interruptions (item_id, end_month, resume_month) VALUES (?, ?, ?)'
    ).run(itemId, endMonth, resumeMonth ?? null)
  }

  updateById(id: number, endMonth: string, resumeMonth?: string | null): void {
    this.db.prepare(
      'UPDATE item_interruptions SET end_month = ?, resume_month = ? WHERE id = ?'
    ).run(endMonth, resumeMonth ?? null, id)
  }

  deleteById(id: number): void {
    this.db.prepare('DELETE FROM item_interruptions WHERE id = ?').run(id)
  }

  hasPermanent(itemId: number): boolean {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM item_interruptions WHERE item_id = ? AND resume_month IS NULL'
    ).get(itemId) as any
    return row.cnt > 0
  }
}
