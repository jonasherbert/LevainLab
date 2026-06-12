export type SoakerKind =
  | 'flour'
  | 'bread'
  | 'sunflower'
  | 'pumpkin'
  | 'flaxseed'
  | 'oats'
  | 'rye'
  | 'sesame'
  | 'grain' // legacy fallback

export interface SoakerDefinition {
  label: string
  isFlour: boolean
  waterRatio: number        // water relative to dry weight (0.5 = 50%)
  freeWaterFraction: number // fraction of water that stays free in the dough
}

export const soakerDefinitions: Map<SoakerKind, SoakerDefinition> = new Map([
  ['flour',     { label: 'Mehlkochstück',        isFlour: true,  waterRatio: 5.0, freeWaterFraction: 1.0  }],
  ['bread',     { label: 'Altbrot (Brühstück)',   isFlour: true,  waterRatio: 1.0, freeWaterFraction: 0.85 }],
  ['sunflower', { label: 'Sonnenblumenkerne',     isFlour: false, waterRatio: 0.5, freeWaterFraction: 0    }],
  ['pumpkin',   { label: 'Kürbiskerne',           isFlour: false, waterRatio: 0.5, freeWaterFraction: 0    }],
  ['flaxseed',  { label: 'Leinsaat (geschrotet)', isFlour: false, waterRatio: 2.0, freeWaterFraction: 0    }],
  ['oats',      { label: 'Haferflocken',          isFlour: false, waterRatio: 2.0, freeWaterFraction: 0    }],
  ['rye',       { label: 'Roggenschrot',          isFlour: false, waterRatio: 2.0, freeWaterFraction: 0    }],
  ['sesame',    { label: 'Sesam',                 isFlour: false, waterRatio: 0.5, freeWaterFraction: 0    }],
  ['grain',     { label: 'Körner (allgemein)',    isFlour: false, waterRatio: 1.0, freeWaterFraction: 0.1  }],
])

export interface SoakerComponent {
  id: string
  kind: SoakerKind
  dry: number
  water: number
}

export type VorteigType = 'poolish' | 'biga'

export interface VorteigDefinition {
  label: string
  defaultFlourPercent: number
  defaultHydration: number
  defaultYeastPercent: number
  defaultFermentationHours: number
  defaultFermentationTemp: number
}

export const vorteigDefinitions: Map<VorteigType, VorteigDefinition> = new Map([
  ['poolish', { label: 'Poolish', defaultFlourPercent: 30, defaultHydration: 100, defaultYeastPercent: 0.03, defaultFermentationHours: 12, defaultFermentationTemp: 20 }],
  ['biga',    { label: 'Biga',    defaultFlourPercent: 30, defaultHydration: 50,  defaultYeastPercent: 0.2,  defaultFermentationHours: 18, defaultFermentationTemp: 18 }],
])

export interface Vorteig {
  id: string
  type: VorteigType
  flourPercent: number
  hydration: number
  yeastPercent: number
  fermentationHours: number
  fermentationTemp: number
}

export interface Starter {
  percent: number
  water: number
  flour: number
  reserve: number
}

export interface FermentationSettings {
  mode: 'manual' | 'time'
  roomHours: number
  roomTemp: number
  fridgeHours: number
  fridgeTemp: number
  leaveningContribution: number  // 0–1: Anteil Sauerteig (1 = nur ST, 0 = nur Hefe)
}

export interface DoughState {
  totalFlour: number
  targetHydration: number

  saltPercent: number
  yeastPercent: number
  maltPercent: number

  starter: Starter
  fermentation: FermentationSettings
  vorteige: Vorteig[]
  soakers: SoakerComponent[]
}
