import {
  isSoakerKind,
  isVorteigType,
  soakerDefinitions,
  vorteigDefinitions,
  type DoughState,
} from '@/types/dough'
import { isFiniteNumber } from '@/utils/numbers'
import {
  asArray,
  asRecord,
  createDefaultState,
  sanitizeNumber,
  sanitizeState,
} from '@/utils/schema'

/** Schlüssel aus v1, damit gespeicherte Eingaben erhalten bleiben. */
export const STORAGE_KEY = 'bread'
export const LEGACY_VERSION_KEY = 'bread_schema_v'
export const SCHEMA_VERSION = 2

interface Envelope {
  schemaVersion: unknown
  state: unknown
}

const isEnvelope = (value: unknown): value is Envelope => {
  const record = asRecord(value)
  return 'schemaVersion' in record && 'state' in record
}

/** Speichert den State zusammen mit seiner Schema-Version. */
export const serializeState = (state: unknown): string =>
  JSON.stringify({ schemaVersion: SCHEMA_VERSION, state })

/**
 * Liest gespeicherte Daten. Wirft nie: v1-Daten werden migriert, v2 bereinigt, alles andere
 * (unbekannte oder neuere Versionen, kaputtes JSON) führt zu den Defaults.
 */
export const restoreState = (raw: string, legacyVersion: number | null): DoughState => {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isEnvelope(parsed)) {
      return parsed.schemaVersion === SCHEMA_VERSION
        ? sanitizeState(parsed.state)
        : createDefaultState()
    }
    if (legacyVersion === 1) return migrateV1ToV2(parsed)
  } catch {
    // kaputte Daten → Defaults
  }
  return createDefaultState()
}

/**
 * v1 → v2:
 * - Vorteig-Hefe war % vom Gesamtmehl, jetzt % vom Vorteigmehl
 * - Einlagen in Gramm → % vom Mehl + Wasserverhältnis; 'grain' → 'sunflower'
 * - Modus 'manual' → 'amount', leaveningContribution (0–1) → sourdoughShare (0–100)
 * - Malz hat in v1 immer beschleunigt → 'active'
 */
export const migrateV1ToV2 = (raw: unknown): DoughState => {
  const v1 = asRecord(raw)
  const starter = asRecord(v1.starter)
  const fermentation = asRecord(v1.fermentation)
  const defaults = createDefaultState()
  const totalFlour = sanitizeNumber(v1.totalFlour, defaults.totalFlour, 'totalFlour')

  return sanitizeState({
    sizingMode: 'flour',
    totalFlour,
    targetHydration: v1.targetHydration,
    saltPercent: v1.saltPercent,
    yeastPercent: v1.yeastPercent,
    maltPercent: v1.maltPercent,
    maltType: 'active',
    starter: {
      percent: starter.percent,
      flour: starter.flour,
      water: starter.water,
      reserve: starter.reserve,
    },
    fermentation: {
      mode: fermentation.mode === 'time' ? 'time' : 'amount',
      roomHours: fermentation.roomHours,
      roomTemp: fermentation.roomTemp,
      fridgeHours: fermentation.fridgeHours,
      fridgeTemp: fermentation.fridgeTemp,
      sourdoughShare: isFiniteNumber(fermentation.leaveningContribution)
        ? fermentation.leaveningContribution * 100
        : undefined,
    },
    vorteige: asArray(v1.vorteige).map((item) => {
      const v = asRecord(item)
      if (!isVorteigType(v.type)) return v
      const flourPercent = sanitizeNumber(
        v.flourPercent,
        vorteigDefinitions[v.type].defaultFlourPercent,
        'vorteigFlourPercent',
      )
      return {
        ...v,
        flourPercent,
        yeastPercent: isFiniteNumber(v.yeastPercent)
          ? (v.yeastPercent * 100) / flourPercent
          : undefined,
      }
    }),
    soakers: asArray(v1.soakers).map((item) => {
      const s = asRecord(item)
      const kind = s.kind === 'grain' ? 'sunflower' : s.kind
      if (!isSoakerKind(kind)) return s
      const dry = isFiniteNumber(s.dry) && s.dry > 0 ? s.dry : 0
      const water = isFiniteNumber(s.water) && s.water > 0 ? s.water : 0
      return {
        id: s.id,
        kind,
        dryPercent: (dry / totalFlour) * 100,
        waterRatio: dry > 0 ? water / dry : soakerDefinitions[kind].defaultWaterRatio,
      }
    }),
  })
}

export const readLegacyVersion = (): number | null => {
  try {
    const value = localStorage.getItem(LEGACY_VERSION_KEY)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
}

export const clearLegacyVersion = (): void => {
  try {
    localStorage.removeItem(LEGACY_VERSION_KEY)
  } catch {
    // Speicher nicht verfügbar
  }
}
