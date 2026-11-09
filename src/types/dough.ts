export type SizingMode = 'flour' | 'pieces'
export type FermentationMode = 'amount' | 'time'
export type MaltType = 'active' | 'inactive'
export type StarterPresetId = 'stiff' | 'liquid' | 'lievitoMadre' | 'rye' | 'custom'
export type VorteigType = 'poolish' | 'biga'
export type SoakerKind =
  | 'flour'
  | 'bread'
  | 'oats'
  | 'rye'
  | 'sunflower'
  | 'pumpkin'
  | 'flaxseed'
  | 'sesame'

/**
 * grain: Getreideerzeugnis – zählt zum Gesamtmehl, sein Wasser zählt zur Hydration.
 * seed: Ölsaat – zählt nicht als Mehl, ihr Quellwasser bleibt gebunden.
 */
export type SoakerCategory = 'grain' | 'seed'

export interface StarterSettings {
  preset: StarterPresetId
  /** Versäuerungsgrad: % des Gesamtmehls, das im Sauerteig steckt (inkl. Anstellgut). */
  percent: number
  /** Teile Mehl je 1 Teil Anstellgut. */
  flour: number
  /** Teile Wasser je 1 Teil Anstellgut. */
  water: number
  /** Temperatur während der Reife (°C). */
  temp: number
  /** Menge, die als nächstes Anstellgut zurückbleibt (g). */
  reserve: number
}

export interface FermentationSettings {
  mode: FermentationMode
  /** Raumgare in h (Eingabe im Zeitmodus). */
  roomHours: number
  /** Gärtemperatur = Ziel-Teigtemperatur (°C). */
  roomTemp: number
  fridgeHours: number
  fridgeTemp: number
  /** Anteil des Sauerteigs am Trieb, 0–100 (Zeitmodus). */
  sourdoughShare: number
  /** Stückgare als Teil der Raumgare (h), nur für den Zeitplan. */
  proofHours: number
}

export interface MixingSettings {
  flourTemp: number
  /** Temperaturanstieg durch das Kneten (°C). */
  frictionRise: number
}

export interface Vorteig {
  id: string
  type: VorteigType
  /** % vom Gesamtmehl. */
  flourPercent: number
  /** % vom Vorteigmehl. */
  hydration: number
  /** Frischhefe, % vom Vorteigmehl (Eingabe im Mengenmodus). */
  yeastPercent: number
  /** Gärzeit in h (Eingabe im Zeitmodus). */
  fermentationHours: number
  fermentationTemp: number
}

export interface Soaker {
  id: string
  kind: SoakerKind
  /** Trockenmasse in % vom Gesamtmehl. */
  dryPercent: number
  /** Wasser je g Trockenmasse. */
  waterRatio: number
}

export interface DoughState {
  sizingMode: SizingMode
  totalFlour: number
  pieceCount: number
  /** Teiggewicht je Teigling (g). */
  pieceWeight: number
  /** Verlust beim Verarbeiten (%), wird im Teiglings-Modus auf das Teiggewicht aufgeschlagen. */
  lossPercent: number
  targetHydration: number
  saltPercent: number
  /** Frischhefe im Hauptteig, % vom Gesamtmehl (Eingabe im Mengenmodus). */
  yeastPercent: number
  maltPercent: number
  maltType: MaltType
  /** Öl oder Fett, % vom Gesamtmehl; zählt zum Teiggewicht, nicht zur Hydration. */
  fatPercent: number
  starter: StarterSettings
  fermentation: FermentationSettings
  mixing: MixingSettings
  /** Backzeit als 'HH:MM'. */
  bakeTime: string
  vorteige: Vorteig[]
  soakers: Soaker[]
}

export interface SoakerDefinition {
  label: string
  category: SoakerCategory
  defaultWaterRatio: number
  defaultDryPercent: number
}

export const SOAKER_KINDS: readonly SoakerKind[] = [
  'flour',
  'bread',
  'oats',
  'rye',
  'sunflower',
  'pumpkin',
  'flaxseed',
  'sesame',
]

export const soakerDefinitions: Record<SoakerKind, SoakerDefinition> = {
  flour: { label: 'Mehlkochstück', category: 'grain', defaultWaterRatio: 5, defaultDryPercent: 5 },
  bread: {
    label: 'Altbrot (Brühstück)',
    category: 'grain',
    defaultWaterRatio: 2,
    defaultDryPercent: 10,
  },
  oats: { label: 'Haferflocken', category: 'grain', defaultWaterRatio: 2, defaultDryPercent: 10 },
  rye: { label: 'Roggenschrot', category: 'grain', defaultWaterRatio: 2, defaultDryPercent: 15 },
  sunflower: {
    label: 'Sonnenblumenkerne',
    category: 'seed',
    defaultWaterRatio: 0.5,
    defaultDryPercent: 10,
  },
  pumpkin: {
    label: 'Kürbiskerne',
    category: 'seed',
    defaultWaterRatio: 0.5,
    defaultDryPercent: 10,
  },
  flaxseed: {
    label: 'Leinsaat (geschrotet)',
    category: 'seed',
    defaultWaterRatio: 2,
    defaultDryPercent: 5,
  },
  sesame: { label: 'Sesam', category: 'seed', defaultWaterRatio: 0.5, defaultDryPercent: 5 },
}

export interface VorteigDefinition {
  label: string
  defaultFlourPercent: number
  defaultHydration: number
  /** % vom Vorteigmehl. */
  defaultYeastPercent: number
  defaultFermentationHours: number
  defaultFermentationTemp: number
}

export const VORTEIG_TYPES: readonly VorteigType[] = ['poolish', 'biga']

export const vorteigDefinitions: Record<VorteigType, VorteigDefinition> = {
  poolish: {
    label: 'Poolish',
    defaultFlourPercent: 30,
    defaultHydration: 100,
    defaultYeastPercent: 0.1,
    defaultFermentationHours: 12,
    defaultFermentationTemp: 20,
  },
  biga: {
    label: 'Biga',
    defaultFlourPercent: 30,
    defaultHydration: 50,
    defaultYeastPercent: 1,
    defaultFermentationHours: 18,
    defaultFermentationTemp: 18,
  },
}

export interface StarterPreset {
  id: Exclude<StarterPresetId, 'custom'>
  label: string
  flour: number
  water: number
}

export const starterPresets: readonly StarterPreset[] = [
  { id: 'stiff', label: 'Fest', flour: 5, water: 3 },
  { id: 'liquid', label: 'Flüssig', flour: 5, water: 5 },
  { id: 'lievitoMadre', label: 'Lievito Madre', flour: 2, water: 1 },
  { id: 'rye', label: 'Roggen', flour: 10, water: 10 },
]

export const STARTER_PRESET_IDS: readonly StarterPresetId[] = [
  'stiff',
  'liquid',
  'lievitoMadre',
  'rye',
  'custom',
]

export const SIZING_MODES: readonly SizingMode[] = ['flour', 'pieces']
export const FERMENTATION_MODES: readonly FermentationMode[] = ['amount', 'time']
export const MALT_TYPES: readonly MaltType[] = ['active', 'inactive']

export const matchStarterPreset = (flour: number, water: number): StarterPresetId =>
  starterPresets.find((p) => p.flour === flour && p.water === water)?.id ?? 'custom'

/** Teigausbeute des Sauerteigs: 100 + Wasser je 100 Teile Mehl. */
export const starterTa = (flour: number, water: number): number =>
  flour > 0 ? 100 + (100 * water) / flour : 100

const isOneOf = <T extends string>(allowed: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)

export const isSoakerKind = (value: unknown): value is SoakerKind => isOneOf(SOAKER_KINDS, value)
export const isVorteigType = (value: unknown): value is VorteigType => isOneOf(VORTEIG_TYPES, value)
export const isStarterPresetId = (value: unknown): value is StarterPresetId =>
  isOneOf(STARTER_PRESET_IDS, value)
export const isSizingMode = (value: unknown): value is SizingMode => isOneOf(SIZING_MODES, value)
export const isFermentationMode = (value: unknown): value is FermentationMode =>
  isOneOf(FERMENTATION_MODES, value)
export const isMaltType = (value: unknown): value is MaltType => isOneOf(MALT_TYPES, value)
