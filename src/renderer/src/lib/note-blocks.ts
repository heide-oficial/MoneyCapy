export interface NoteBlock {
  id: string
  createdAt: string
  text: string
}

const NOTE_BLOCKS_TYPE = 'moneycapy.noteBlocks.v1'

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createNoteBlock(): NoteBlock {
  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    text: ''
  }
}

export function parseNoteBlocks(raw?: string | null): NoteBlock[] {
  const value = (raw || '').trim()
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (parsed?.type === NOTE_BLOCKS_TYPE && Array.isArray(parsed.blocks)) {
      return parsed.blocks
        .filter((block: any) => typeof block?.text === 'string')
        .map((block: any) => ({
          id: String(block.id || createId()),
          createdAt: typeof block.createdAt === 'string' ? block.createdAt : '',
          text: block.text
        }))
    }
  } catch {
    // Existing free-text notes are kept as one legacy block.
  }

  return [{ id: 'legacy', createdAt: '', text: raw || '' }]
}

export function serializeNoteBlocks(blocks: NoteBlock[]): string {
  const normalized = blocks
    .map(block => ({ ...block, text: block.text.trimEnd() }))
    .filter(block => block.text.trim().length > 0)

  if (normalized.length === 0) return ''

  return JSON.stringify({
    type: NOTE_BLOCKS_TYPE,
    blocks: normalized
  })
}

export function formatNoteBlockDate(createdAt: string, fallback: string): string {
  if (!createdAt) return fallback
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleString()
}
