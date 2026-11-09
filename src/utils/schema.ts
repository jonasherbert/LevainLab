import {
  isFermentationMode,
  isMaltType,
  isSizingMode,
  isSoakerKind,
  isStarterPresetId,
  isVorteigType,
  matchStarterPreset,
  soakerDefinitions,
  starterPresets,
  vorteigDefinitions,
  type DoughState,
  type Soaker,
  type SoakerKind,
  type StarterPresetId,
  type Vorteig,
  type VorteigType,
} from '@/types/dough'
import { createId } from './id'
import { clamp, isFiniteNumber } from './numbers'

export interface FieldSpec {
  min: number
  max: number
  decimals: number
}

/** Erlaubte Bereiche je Eingabefeld; genutzt von der Bereinigung und von `NumberField`. */
export const FIELDS = {
  totalFlour: { min: 1, max: 50000, decimals: 0 },
  pieceCount: { min: 1, max: 100, decimals: 0 },
  pieceWeight: { min: 10, max: 10000, decimals: 0 },
  lossPercent: { min: 0, max: 20, decimals: 1 },
  targetHydration: { min: 40, max: 150, decimals: 1 },
  saltPercent: { min: 0, max: 5, decimals: 2 },
  yeastPercent: { min: 0, max: 5, decimals: 3 },
  maltPercent: { min: 0, max: 10, decimals: 1 },
  fatPercent: { min: 0, max: 30, decimals: 1 },
  starterPercent: { min: 0, max: 80, decimals: 1 },
  starterFlour: { min: 0.5, max: 20, decimals: 1 },
  starterWater: { min: 0, max: 20, decimals: 1 },
  starterTemp: { min: 0, max: 40, decimals: 1 },
  starterReserve: { min: 0, max: 1000, decimals: 0 },
  roomHours: { min: 0, max: 72, decimals: 1 },
  roomTemp: { min: 0, max: 40, decimals: 1 },
  fridgeHours: { min: 0, max: 168, decimals: 1 },
  fridgeTemp: { min: -5, max: 15, decimals: 1 },
  sourdoughShare: { min: 0, max: 100, decimals: 0 },
  proofHours: { min: 0, max: 24, decimals: 1 },
  flourTemp: { min: 0, max: 40, decimals: 1 },
  frictionRise: { min: 0, max: 20, decimals: 1 },
  vorteigFlourPercent: { min: 1, max: 100, decimals: 0 },
  vorteigHydration: { min: 40, max: 150, decimals: 0 },
  vorteigYeastPercent: { min: 0, max: 5, decimals: 3 },
  vorteigHours: { min: 0, max: 72, decimals: 1 },
  vorteigTemp: { min: 0, max: 40, decimals: 1 },
  soakerGrams: { min: 0, max: 10000, decimals: 0 },
  soakerDryPercent: { min: 0, max: 100, decimals: 6 },
  soakerWaterRatio: { min: 0, max: 10, decimals: 6 },
} as const satisfies Record<string, FieldSpec>

export type FieldKey = keyof typeof FIELDS

export const DEFAULT_BAKE_TIME = '18:00'
const CLOCK_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const isClockTime = (value: unknown): value is string =>
  typeof value === 'string' && CLOCK_PATTERN.test(value)

export const createDefaultState = (): DoughState => ({
  sizingMode: 'flour',
  totalFlour: 1000,
  pieceCount: 2,
  pieceWeight: 900,
  lossPercent: 3,
  targetHydration: 75,
  saltPercent: 2.2,
  yeastPercent: 0,
  maltPercent: 0,
  maltType: 'active',
  fatPercent: 0,
  starter: { preset: 'stiff', percent: 20, flour: 5, water: 3, temp: 21, reserve: 25 },
  fermentation: {
    mode: 'amount',
    roomHours: 8,
    roomTemp: 21,
    fridgeHours: 0,
    fridgeTemp: 5,
    sourdoughShare: 100,
    proofHours: 1.5,
  },
  mixing: { flourTemp: 21, frictionRise: 2 },
  bakeTime: DEFAULT_BAKE_TIME,
  vorteige: [],
  soakers: [],
})

export const createVorteig = (type: VorteigType, id: string = createId()): Vorteig => {
  const def = vorteigDefinitions[type]
  return {
    id,
    type,
    flourPercent: def.defaultFlourPercent,
    hydration: def.defaultHydration,
    yeastPercent: def.defaultYeastPercent,
    fermentationHours: def.defaultFermentationHours,
    fermentationTemp: def.defaultFermentationTemp,
  }
}

export const createSoaker = (kind: SoakerKind, id: string = createId()): Soaker => {
  const def = soakerDefinitions[kind]
  return { id, kind, dryPercent: def.defaultDryPercent, waterRatio: def.defaultWaterRatio }
}

/** Begrenzt einen Wert auf den erlaubten Bereich des Feldes. */
export const fitField = (field: FieldKey, value: number): number =>
  clamp(value, FIELDS[field].min, FIELDS[field].max)

type UnknownRecord = Record<string, unknown>

export const asRecord = (value: unknown): UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {}

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** Gültige Zahl → auf den Bereich begrenzt; alles andere → Fallback. */
export const sanitizeNumber = (value: unknown, fallback: number, field: FieldKey): number =>
  isFiniteNumber(value) ? fitField(field, value) : fallback

const sanitizePreset = (value: unknown, flour: number, water: number): StarterPresetId => {
  if (!isStarterPresetId(value)) return matchStarterPreset(flour, water)
  if (value === 'custom') return value
  const preset = starterPresets.find((p) => p.id === value)
  return preset && preset.flour === flour && preset.water === water
    ? value
    : matchStarterPreset(flour, water)
}

/**
 * Macht aus beliebigen Daten einen gültigen State: ungültige Werte („“, NaN, null, falscher Typ)
 * werden zum Default, Zahlen werden auf den erlaubten Bereich begrenzt, unbekannte Vorteig- und
 * Einlagentypen verworfen, fehlende oder doppelte IDs ersetzt. Es wird nicht gerundet.
 */
export const sanitizeState = (raw: unknown, newId: () => string = createId): DoughState => {
  const d = createDefaultState()
  const r = asRecord(raw)
  const starter = asRecord(r.starter)
  const fermentation = asRecord(r.fermentation)
  const mixing = asRecord(r.mixing)

  const seenIds = new Set<string>()
  const uniqueId = (value: unknown): string => {
    const id = typeof value === 'string' && value !== '' && !seenIds.has(value) ? value : newId()
    seenIds.add(id)
    return id
  }

  const starterFlour = sanitizeNumber(starter.flour, d.starter.flour, 'starterFlour')
  const starterWater = sanitizeNumber(starter.water, d.starter.water, 'starterWater')

  const vorteige = asArray(r.vorteige).flatMap((item): Vorteig[] => {
    const v = asRecord(item)
    if (!isVorteigType(v.type)) return []
    const def = vorteigDefinitions[v.type]
    return [
      {
        id: uniqueId(v.id),
        type: v.type,
        flourPercent: sanitizeNumber(
          v.flourPercent,
          def.defaultFlourPercent,
          'vorteigFlourPercent',
        ),
        hydration: sanitizeNumber(v.hydration, def.defaultHydration, 'vorteigHydration'),
        yeastPercent: sanitizeNumber(
          v.yeastPercent,
          def.defaultYeastPercent,
          'vorteigYeastPercent',
        ),
        fermentationHours: sanitizeNumber(
          v.fermentationHours,
          def.defaultFermentationHours,
          'vorteigHours',
        ),
        fermentationTemp: sanitizeNumber(
          v.fermentationTemp,
          def.defaultFermentationTemp,
          'vorteigTemp',
        ),
      },
    ]
  })

  const soakers = asArray(r.soakers).flatMap((item): Soaker[] => {
    const s = asRecord(item)
    if (!isSoakerKind(s.kind)) return []
    const def = soakerDefinitions[s.kind]
    return [
      {
        id: uniqueId(s.id),
        kind: s.kind,
        dryPercent: sanitizeNumber(s.dryPercent, def.defaultDryPercent, 'soakerDryPercent'),
        waterRatio: sanitizeNumber(s.waterRatio, def.defaultWaterRatio, 'soakerWaterRatio'),
      },
    ]
  })

  return {
    sizingMode: isSizingMode(r.sizingMode) ? r.sizingMode : d.sizingMode,
    totalFlour: sanitizeNumber(r.totalFlour, d.totalFlour, 'totalFlour'),
    pieceCount: sanitizeNumber(r.pieceCount, d.pieceCount, 'pieceCount'),
    pieceWeight: sanitizeNumber(r.pieceWeight, d.pieceWeight, 'pieceWeight'),
    lossPercent: sanitizeNumber(r.lossPercent, d.lossPercent, 'lossPercent'),
    targetHydration: sanitizeNumber(r.targetHydration, d.targetHydration, 'targetHydration'),
    saltPercent: sanitizeNumber(r.saltPercent, d.saltPercent, 'saltPercent'),
    yeastPercent: sanitizeNumber(r.yeastPercent, d.yeastPercent, 'yeastPercent'),
    maltPercent: sanitizeNumber(r.maltPercent, d.maltPercent, 'maltPercent'),
    maltType: isMaltType(r.maltType) ? r.maltType : d.maltType,
    fatPercent: sanitizeNumber(r.fatPercent, d.fatPercent, 'fatPercent'),
    starter: {
      preset: sanitizePreset(starter.preset, starterFlour, starterWater),
      percent: sanitizeNumber(starter.percent, d.starter.percent, 'starterPercent'),
      flour: starterFlour,
      water: starterWater,
      temp: sanitizeNumber(starter.temp, d.starter.temp, 'starterTemp'),
      reserve: sanitizeNumber(starter.reserve, d.starter.reserve, 'starterReserve'),
    },
    fermentation: {
      mode: isFermentationMode(fermentation.mode) ? fermentation.mode : d.fermentation.mode,
      roomHours: sanitizeNumber(fermentation.roomHours, d.fermentation.roomHours, 'roomHours'),
      roomTemp: sanitizeNumber(fermentation.roomTemp, d.fermentation.roomTemp, 'roomTemp'),
      fridgeHours: sanitizeNumber(
        fermentation.fridgeHours,
        d.fermentation.fridgeHours,
        'fridgeHours',
      ),
      fridgeTemp: sanitizeNumber(fermentation.fridgeTemp, d.fermentation.fridgeTemp, 'fridgeTemp'),
      sourdoughShare: sanitizeNumber(
        fermentation.sourdoughShare,
        d.fermentation.sourdoughShare,
        'sourdoughShare',
      ),
      proofHours: sanitizeNumber(fermentation.proofHours, d.fermentation.proofHours, 'proofHours'),
    },
    mixing: {
      flourTemp: sanitizeNumber(mixing.flourTemp, d.mixing.flourTemp, 'flourTemp'),
      frictionRise: sanitizeNumber(mixing.frictionRise, d.mixing.frictionRise, 'frictionRise'),
    },
    bakeTime: isClockTime(r.bakeTime) ? r.bakeTime : d.bakeTime,
    vorteige,
    soakers,
  }
}
