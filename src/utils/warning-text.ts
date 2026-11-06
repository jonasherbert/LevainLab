import type { AmountsBySource, DoughWarning } from '@/types/dough-result'
import { formatGrams, formatHours, formatPercent, formatTemp } from './format'
import { WATER_TEMP_MIN } from './water-temperature'

export type WarningSeverity = 'error' | 'warning' | 'info'

export interface WarningView {
  key: string
  severity: WarningSeverity
  text: string
}

const listSources = (sources: AmountsBySource): string =>
  [
    sources.starter > 0 ? `Sauerteig ${formatGrams(sources.starter)}` : null,
    sources.vorteige > 0 ? `Vorteige ${formatGrams(sources.vorteige)}` : null,
    sources.soakers > 0 ? `Einlagen ${formatGrams(sources.soakers)}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ')

/** Deutscher Text und Schweregrad zu einer Warnung der Rechenlogik. */
export const describeWarning = (
  warning: DoughWarning,
  vorteigLabel: (id: string) => string,
): WarningView => {
  switch (warning.code) {
    case 'flour-overflow':
      return {
        key: warning.code,
        severity: 'error',
        text:
          `Zu viel Mehl in den Vorstufen (${listSources(warning.sources)}): zusammen ` +
          `${formatGrams(warning.excess)} mehr als das Gesamtmehl. ` +
          'Anteile senken oder Gesamtmehl erhöhen.',
      }
    case 'water-overflow':
      return {
        key: warning.code,
        severity: 'error',
        text:
          `Zu viel Wasser in den Vorstufen (${listSources(warning.sources)}): zusammen ` +
          `${formatGrams(warning.excess)} mehr, als die Hydration erlaubt. ` +
          'Hydration erhöhen oder Anteile senken.',
      }
    case 'vorteig-oversupply':
      return {
        key: warning.code,
        severity: 'warning',
        text:
          'Die Vorteige allein lassen den Teig schneller reifen als geplant' +
          (warning.estimatedHours === null
            ? '. '
            : `: ca. ${formatHours(warning.estimatedHours)} statt ` +
              `${formatHours(warning.plannedHours)} Raumgare. `) +
          'Raumgare verkürzen oder weniger Vorteig nehmen.',
      }
    case 'fridge-overproof':
      return {
        key: warning.code,
        severity: 'warning',
        text:
          'Schon die Kühlschrankgare reicht für diese Triebmittelmenge, der Teig wäre überreif ' +
          `(${formatPercent(warning.progress * 100, 0)} Gärfortschritt). ` +
          'Weniger Sauerteig oder Hefe nehmen oder die Kühlschrankgare verkürzen.',
      }
    case 'no-leavening':
      return {
        key: warning.code,
        severity: 'warning',
        text:
          'Kein Triebmittel: Versäuerungsgrad, Hefe und Vorteig-Hefe sind 0. ' +
          'Ohne Trieb lassen sich Gärzeit und Zeitplan nicht berechnen.',
      }
    case 'no-fermentation-time':
      return {
        key: warning.code,
        severity: 'error',
        text:
          'Ohne Gärzeit lässt sich keine Triebmittelmenge berechnen. ' +
          'Raumgare oder Kühlschrankgare eingeben.',
      }
    case 'vorteig-no-yeast':
      return {
        key: `${warning.code}-${warning.vorteigId}`,
        severity: 'warning',
        text: `${vorteigLabel(warning.vorteigId)}: Ohne Hefe gärt der Vorteig nicht.`,
      }
    case 'vorteig-no-time':
      return {
        key: `${warning.code}-${warning.vorteigId}`,
        severity: 'warning',
        text: `${vorteigLabel(warning.vorteigId)}: Ohne Gärzeit lässt sich keine Hefemenge berechnen.`,
      }
    case 'sourdough-implausible':
      return {
        key: warning.code,
        severity: 'warning',
        text:
          `Ein Versäuerungsgrad von ${formatPercent(warning.percent)} ist ungewöhnlich hoch. ` +
          'Vermutlich ist die Gärzeit zu kurz.',
      }
    case 'yeast-implausible':
      return {
        key: `${warning.code}-${warning.vorteigId ?? 'main'}`,
        severity: 'warning',
        text:
          `${warning.vorteigId ? vorteigLabel(warning.vorteigId) : 'Hauptteig'}: ` +
          `${formatPercent(warning.percent, 2)} Frischhefe ist ungewöhnlich viel. ` +
          'Vermutlich ist die Gärzeit zu kurz.',
      }
    case 'water-temp-out-of-range':
      return {
        key: warning.code,
        severity: 'warning',
        text:
          `Das Schüttwasser müsste ${formatTemp(warning.waterTemp)} haben. ` +
          (warning.waterTemp < WATER_TEMP_MIN
            ? 'Dafür braucht es Eis – kühlere Zutaten, weniger Knetwärme oder eine höhere ' +
              'Gärtemperatur helfen.'
            : 'Das schadet Hefe und Sauerteig – wärmere Zutaten oder eine niedrigere ' +
              'Gärtemperatur helfen.'),
      }
    case 'altbrot-high':
      return {
        key: warning.code,
        severity: 'info',
        text:
          `Altbrot macht ${formatPercent(warning.percent, 0)} vom Mehl aus. ` +
          'Üblich sind höchstens 10–15 %, sonst wird die Krume feucht.',
      }
  }
}
