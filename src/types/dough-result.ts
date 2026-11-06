import type { FermentationMode, SoakerCategory, SoakerKind, VorteigType } from './dough'

export interface AmountsBySource {
  starter: number
  vorteige: number
  soakers: number
}

export interface LeaveningProgress {
  sourdough: number
  yeast: number
  vorteige: number
}

export interface LeaveningResult {
  mode: FermentationMode
  /** Versäuerungsgrad (Eingabe oder berechnet). */
  sourdoughPercent: number
  /** Frischhefe im Hauptteig, % vom Gesamtmehl (Eingabe oder berechnet). */
  yeastPercent: number
  /** Anteil des Sauerteigs am Trieb von Sauerteig + Hefe, 0–100. */
  sourdoughShare: number
  /** Hefe aller Vorteige, % vom Gesamtmehl. */
  vorteigYeastPercent: number
  /** Raumgare: Eingabe (Zeitmodus) oder Schätzung (Mengenmodus); null ohne Triebmittel. */
  roomHours: number | null
  fridgeHours: number
  maltFactor: number
  /** Gärfortschritt je Triebmittel bei der Raumgare (Summe 1 = reif). */
  progress: LeaveningProgress | null
  usesSourdough: boolean
}

export interface StarterProfile {
  /** Hydration der Fütterung in %. */
  hydration: number
  ta: number
  seedFlourFraction: number
  ripeningHours: number
  temp: number
}

export interface StarterBuild {
  /** Mehl im Sauerteig fürs Rezept, inkl. Anstellgut. */
  flourInDough: number
  waterInDough: number
  forRecipe: number
  reserve: number
  total: number
  seed: number
  feedFlour: number
  feedWater: number
}

export interface VorteigResult {
  id: string
  type: VorteigType
  flour: number
  water: number
  yeast: number
  /** Frischhefe, % vom Vorteigmehl (Eingabe oder berechnet). */
  yeastPercent: number
  total: number
  /** Gärzeit: Eingabe (Zeitmodus) oder Schätzung (Mengenmodus). */
  hours: number | null
  temp: number
}

export interface SoakerResult {
  id: string
  kind: SoakerKind
  category: SoakerCategory
  dryPercent: number
  waterRatio: number
  dry: number
  water: number
  total: number
}

export interface MainDoughResult {
  flour: number
  water: number
  salt: number
  yeast: number
  malt: number
}

export interface WaterTemperatureResult {
  targetTemp: number
  frictionRise: number
  /** Benötigte Schüttwassertemperatur; null ohne Wasser im Hauptteig. */
  waterTemp: number | null
}

export type ScheduleStepKind =
  | 'soakers'
  | 'starter'
  | 'vorteig'
  | 'mix'
  | 'shape'
  | 'fridge'
  | 'bake'

export interface ScheduleStep {
  kind: ScheduleStepKind
  refId: string | null
  hoursBeforeBake: number
  /** 0 = Backtag, −1 = Vortag, … */
  dayOffset: number
  time: string
}

export interface ScheduleResult {
  bakeTime: string
  steps: ScheduleStep[]
}

export interface SummaryResult {
  doughWeight: number
  /** Hydration aus allen gezählten Wassermengen (ohne gebundenes Saatenwasser). */
  hydration: number
  hydrationInclSeedWater: number
  ta: number
  /** Mehl in Sauerteig und Vorteigen, % vom Gesamtmehl. */
  prefermentedFlourPercent: number
  pieceCount: number | null
  pieceWeight: number | null
}

export type DoughWarning =
  | { code: 'flour-overflow'; excess: number; sources: AmountsBySource }
  | { code: 'water-overflow'; excess: number; sources: AmountsBySource }
  | { code: 'vorteig-oversupply'; plannedHours: number; estimatedHours: number | null }
  | { code: 'fridge-overproof'; progress: number }
  | { code: 'no-leavening' }
  | { code: 'no-fermentation-time' }
  | { code: 'vorteig-no-yeast'; vorteigId: string }
  | { code: 'vorteig-no-time'; vorteigId: string }
  | { code: 'sourdough-implausible'; percent: number }
  | { code: 'yeast-implausible'; percent: number; vorteigId: string | null }
  | { code: 'water-temp-out-of-range'; waterTemp: number }
  | { code: 'altbrot-high'; percent: number }

export type DoughWarningCode = DoughWarning['code']

export interface DoughResult {
  totalFlour: number
  doughWeight: number
  summary: SummaryResult
  leavening: LeaveningResult
  starterProfile: StarterProfile
  /** Fütterung und Sauerteigmenge; null ohne Sauerteig. */
  starter: StarterBuild | null
  vorteige: VorteigResult[]
  soakers: SoakerResult[]
  main: MainDoughResult
  waterTemperature: WaterTemperatureResult
  /** null, wenn sich keine Raumgare bestimmen lässt. */
  schedule: ScheduleResult | null
  warnings: DoughWarning[]
}
