export function applyStoredOrder<T>(
  items: T[],
  storedOrder: (string | number)[],
  getId: (item: T) => string | number
): T[] {
  const itemMap = new Map(items.map(item => [getId(item), item]))
  const ordered: T[] = []
  const seen = new Set<string | number>()

  for (const id of storedOrder) {
    const item = itemMap.get(id)
    if (item) {
      ordered.push(item)
      seen.add(id)
    }
  }

  for (const item of items) {
    if (!seen.has(getId(item))) {
      ordered.push(item)
    }
  }

  return ordered
}
