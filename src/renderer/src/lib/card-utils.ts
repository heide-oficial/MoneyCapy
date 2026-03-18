const TYPE_LABELS: Record<string, string> = {
  credit: 'crédito',
  debit: 'débito',
  both: 'crédito/débito'
}

export function getTypeLabels(t?: (key: string) => string): Record<string, string> {
  if (t) {
    return {
      credit: t('cardTypes.credit'),
      debit: t('cardTypes.debit'),
      both: t('cardTypes.both')
    }
  }
  return TYPE_LABELS // fallback to Portuguese
}

/**
 * Resolve the payment type label for a card.
 * Prefers item-level paymentMethod, falls back to card_type.
 */
function resolvePaymentLabel(
  cardType?: string | null,
  paymentMethod?: string | null,
  typeLabels?: Record<string, string>
): string | null {
  const labels = typeLabels || TYPE_LABELS
  if (paymentMethod) return labels[paymentMethod] || paymentMethod
  if (cardType) return labels[cardType] || cardType
  return null
}

/**
 * Format a single card name with its payment type.
 * e.g. "Nubank (credito)"
 */
export function formatCardLabel(
  cardName: string,
  cardType?: string | null,
  paymentMethod?: string | null,
  typeLabels?: Record<string, string>
): string {
  const label = resolvePaymentLabel(cardType, paymentMethod, typeLabels)
  return label ? `${cardName} (${label})` : cardName
}

/**
 * Build card display info for an item.
 * Handles both single-card and multi-card (splits) items.
 * Returns an array of formatted card labels.
 */
export function getItemCardLabels(
  item: {
    cardName?: string | null
    cardType?: string | null
    paymentMethod?: string | null
    cardSplits?: { cardName?: string | null; cardType?: string | null }[]
  },
  typeLabels?: Record<string, string>
): string[] {
  const splits = item.cardSplits || []

  if (splits.length > 0) {
    return splits
      .filter(sp => sp.cardName)
      .map(sp => formatCardLabel(sp.cardName!, sp.cardType || 'credit', undefined, typeLabels))
  }

  if (item.cardName) {
    return [formatCardLabel(item.cardName, item.cardType, item.paymentMethod, typeLabels)]
  }

  return []
}
