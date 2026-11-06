import { isFiniteNumber, roundTo } from './numbers'

const NBSP = ' '
const LOCALE = 'de-DE'

const formatterCache = new Map<string, Intl.NumberFormat>()

const getFormatter = (
  minDecimals: number,
  maxDecimals: number,
  grouping: boolean,
): Intl.NumberFormat => {
  const key = `${minDecimals}|${maxDecimals}|${grouping}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
      useGrouping: grouping,
    })
    formatterCache.set(key, formatter)
  }
  return formatter
}

/**
 * Liest eine Zahl aus einer Eingabe. Komma und Punkt sind beide Dezimaltrennzeichen;
 * in Ganzzahlfeldern gilt „1.000“ als Tausendergruppierung.
 * Liefert null für leere oder ungültige Eingaben (auch „-“ oder „1e3“).
 */
export const parseDecimal = (text: string, options: { integer?: boolean } = {}): number | null => {
  let value = text.replace(/[\s  ]/g, '')
  if (value === '') return null
  if (options.integer && /^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '')
  const lastSeparator = Math.max(value.lastIndexOf(','), value.lastIndexOf('.'))
  if (lastSeparator >= 0) {
    value = `${value.slice(0, lastSeparator).replace(/[.,]/g, '')}.${value.slice(lastSeparator + 1)}`
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Wert für ein Eingabefeld: ohne Tausenderpunkt, höchstens `decimals` Nachkommastellen. */
export const formatInputNumber = (value: number, decimals: number): string =>
  isFiniteNumber(value) ? getFormatter(0, decimals, false).format(roundTo(value, decimals)) : ''

/** Zahl für die Anzeige mit festen Nachkommastellen; „–“ ohne Wert. */
export const formatNumber = (value: number | null | undefined, decimals = 0): string =>
  isFiniteNumber(value)
    ? getFormatter(decimals, decimals, true).format(roundTo(value, decimals))
    : '–'

/** Zahl mit Einheit, höchstens `maxDecimals` Nachkommastellen, ohne überflüssige Nullen: „12 h“, „4,6 h“. */
export const formatCompact = (
  value: number | null | undefined,
  unit: string,
  maxDecimals = 1,
): string =>
  isFiniteNumber(value)
    ? `${getFormatter(0, maxDecimals, true).format(roundTo(value, maxDecimals))}${NBSP}${unit}`
    : '–'

const withUnit = (value: number | null | undefined, decimals: number, unit: string): string =>
  isFiniteNumber(value) ? `${formatNumber(value, decimals)}${NBSP}${unit}` : '–'

export const formatGrams = (value: number | null | undefined, decimals = 0): string =>
  withUnit(value, decimals, 'g')

export const formatPercent = (value: number | null | undefined, decimals = 1): string =>
  withUnit(value, decimals, '%')

export const formatTemp = (value: number | null | undefined, decimals = 0): string =>
  withUnit(value, decimals, '°C')

export const formatHours = (value: number | null | undefined, decimals = 1): string =>
  withUnit(value, decimals, 'h')

export const formatDayLabel = (dayOffset: number): string => {
  if (dayOffset === 0) return 'Backtag'
  if (dayOffset === -1) return 'Vortag'
  if (dayOffset < -1) return `${-dayOffset} Tage vorher`
  return dayOffset === 1 ? 'Folgetag' : `${dayOffset} Tage später`
}

/** true, wenn der Wert gerundet größer als 0 ist (zum Ausblenden leerer Zeilen). */
export const hasAmount = (value: number | null | undefined, decimals = 0): boolean =>
  isFiniteNumber(value) && roundTo(value, decimals) > 0

/** Sammlung der Formatter für Templates. */
export const fmt = {
  num: formatNumber,
  grams: formatGrams,
  percent: formatPercent,
  temp: formatTemp,
  hours: formatHours,
  compact: formatCompact,
  day: formatDayLabel,
  has: hasAmount,
}
