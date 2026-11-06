export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Rundet auf `decimals` Nachkommastellen; liefert nie −0. */
export const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor + 0
}

export const sumBy = <T>(items: readonly T[], pick: (item: T) => number): number =>
  items.reduce((sum, item) => sum + pick(item), 0)
