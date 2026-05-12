export interface InstallmentMonthValueInput {
  monthlyValue: number
  anticipatedCount?: number | null
  discountedTotal?: number | null
  currentPaymentPaidValue?: number | null
  currentPaymentOriginalValue?: number | null
}

export function getFutureAnticipationValue(
  monthlyValue: number,
  anticipatedCount?: number | null,
  discountedTotal?: number | null
): number {
  const count = anticipatedCount || 0
  if (count <= 0) return 0
  return discountedTotal ?? monthlyValue * count
}

export function getInstallmentMonthValue({
  monthlyValue,
  anticipatedCount,
  discountedTotal,
  currentPaymentPaidValue,
  currentPaymentOriginalValue
}: InstallmentMonthValueInput): number {
  const futureValue = getFutureAnticipationValue(monthlyValue, anticipatedCount, discountedTotal)

  if (currentPaymentPaidValue == null) {
    return monthlyValue + futureValue
  }

  const coveredOriginalValue = currentPaymentOriginalValue ?? monthlyValue
  const uncoveredValue = Math.max(0, monthlyValue + futureValue - coveredOriginalValue)
  return currentPaymentPaidValue + uncoveredValue
}
