import {
  soakerDefinitions,
  starterTa,
  type DoughState,
  type SoakerKind,
  type StarterSettings,
} from '@/types/dough'
import type {
  AmountsBySource,
  DoughResult,
  DoughWarning,
  MainDoughResult,
  SoakerResult,
  StarterBuild,
  StarterProfile,
  VorteigResult,
} from '@/types/dough-result'
import {
  calcLeavening,
  starterRipeningHours,
  starterSeedFlourFraction,
  type LeaveningCalculation,
} from './fermentation'
import { sumBy } from './numbers'
import { buildSchedule } from './schedule'
import { FIELDS, sanitizeState } from './schema'
import {
  WATER_TEMP_MAX,
  WATER_TEMP_MIN,
  calcWaterTemperature,
  type HeatComponent,
} from './water-temperature'

/** Ab hier ist die Menge ungewöhnlich; meist ist dann die Gärzeit zu kurz. */
export const SOURDOUGH_PERCENT_MAX = 50
export const YEAST_PERCENT_MAX = 4
/** Mehr Altbrot macht die Krume feucht. */
export const ALTBROT_PERCENT_MAX = 15
const OVERFLOW_TOLERANCE = 1e-6

const sumSources = (sources: AmountsBySource): number =>
  sources.starter + sources.vorteige + sources.soakers

export const calcStarterProfile = (starter: StarterSettings): StarterProfile => ({
  hydration: (100 * starter.water) / starter.flour,
  ta: starterTa(starter.flour, starter.water),
  seedFlourFraction: starterSeedFlourFraction(starter.flour, starter.water),
  ripeningHours: starterRipeningHours(starter.flour, starter.water, starter.temp),
  temp: starter.temp,
})

/**
 * Sauerteigmenge und Fütterung. Das Anstellgut hat dieselbe Hydration wie die Fütterung
 * (die Reserve wird das nächste Anstellgut), sein Mehl und Wasser zählen also mit.
 */
export const calcStarterBuild = (
  totalFlour: number,
  sourdoughPercent: number,
  starter: StarterSettings,
): StarterBuild | null => {
  const flourInDough = (totalFlour * sourdoughPercent) / 100
  if (!(flourInDough > 0) || !(starter.flour > 0)) return null
  const waterInDough = (flourInDough * starter.water) / starter.flour
  const forRecipe = flourInDough + waterInDough
  const total = forRecipe + starter.reserve
  const seed = total / (1 + starter.flour + starter.water)
  return {
    flourInDough,
    waterInDough,
    forRecipe,
    reserve: starter.reserve,
    total,
    seed,
    feedFlour: seed * starter.flour,
    feedWater: seed * starter.water,
  }
}

interface Recipe {
  starter: StarterBuild | null
  vorteige: VorteigResult[]
  soakers: SoakerResult[]
  main: MainDoughResult
  flourUsed: AmountsBySource
  waterUsed: AmountsBySource
  flourExcess: number
  waterExcess: number
  boundSeedWater: number
  doughWeight: number
}

const buildRecipe = (
  state: DoughState,
  leavening: LeaveningCalculation,
  totalFlour: number,
): Recipe => {
  const starter = calcStarterBuild(totalFlour, leavening.leavening.sourdoughPercent, state.starter)

  const vorteige = state.vorteige.map((v, i): VorteigResult => {
    const resolved = leavening.vorteige[i]
    const yeastPercent = resolved?.yeastPercent ?? 0
    const flour = (totalFlour * v.flourPercent) / 100
    const water = (flour * v.hydration) / 100
    const yeast = (flour * yeastPercent) / 100
    return {
      id: v.id,
      type: v.type,
      flour,
      water,
      yeast,
      yeastPercent,
      total: flour + water + yeast,
      hours: resolved?.hours ?? null,
      temp: v.fermentationTemp,
    }
  })

  const soakers = state.soakers.map((s): SoakerResult => {
    const dry = (totalFlour * s.dryPercent) / 100
    const water = dry * s.waterRatio
    return {
      id: s.id,
      kind: s.kind,
      category: soakerDefinitions[s.kind].category,
      dryPercent: s.dryPercent,
      waterRatio: s.waterRatio,
      dry,
      water,
      total: dry + water,
    }
  })
  const grainSoakers = soakers.filter((s) => s.category === 'grain')
  const seedSoakers = soakers.filter((s) => s.category === 'seed')

  const flourUsed: AmountsBySource = {
    starter: starter?.flourInDough ?? 0,
    vorteige: sumBy(vorteige, (v) => v.flour),
    soakers: sumBy(grainSoakers, (s) => s.dry),
  }
  const waterUsed: AmountsBySource = {
    starter: starter?.waterInDough ?? 0,
    vorteige: sumBy(vorteige, (v) => v.water),
    soakers: sumBy(grainSoakers, (s) => s.water),
  }

  const mainFlour = totalFlour - sumSources(flourUsed)
  const mainWater = (totalFlour * state.targetHydration) / 100 - sumSources(waterUsed)
  const main: MainDoughResult = {
    flour: Math.max(0, mainFlour),
    water: Math.max(0, mainWater),
    salt: (totalFlour * state.saltPercent) / 100,
    yeast: (totalFlour * leavening.leavening.yeastPercent) / 100,
    malt: (totalFlour * state.maltPercent) / 100,
  }

  const doughWeight =
    main.flour +
    main.water +
    main.salt +
    main.yeast +
    main.malt +
    (starter?.forRecipe ?? 0) +
    sumBy(vorteige, (v) => v.total) +
    sumBy(soakers, (s) => s.total)

  return {
    starter,
    vorteige,
    soakers,
    main,
    flourUsed,
    waterUsed,
    flourExcess: Math.max(0, -mainFlour),
    waterExcess: Math.max(0, -mainWater),
    boundSeedWater: sumBy(seedSoakers, (s) => s.water),
    doughWeight,
  }
}

/**
 * Gesamtmehl. Im Teiglings-Modus skaliert jede Zutat linear mit dem Mehl, also ergibt sich das
 * Mehl aus Teiggewicht geteilt durch die Teigmasse des Rezepts bei 1 g Mehl – auch bei Überlauf.
 */
const resolveTotalFlour = (state: DoughState, leavening: LeaveningCalculation): number => {
  if (state.sizingMode === 'flour') return state.totalFlour
  const doughPerGramFlour = buildRecipe(state, leavening, 1).doughWeight
  return doughPerGramFlour > 0 ? (state.pieceCount * state.pieceWeight) / doughPerGramFlour : 0
}

export const calculateDough = (input: DoughState): DoughResult => {
  const state = sanitizeState(input)
  const leavening = calcLeavening(state)
  const totalFlour = resolveTotalFlour(state, leavening)
  const recipe = buildRecipe(state, leavening, totalFlour)
  const starterProfile = calcStarterProfile(state.starter)
  const { main, starter } = recipe
  const lv = leavening.leavening
  const warnings: DoughWarning[] = [...leavening.warnings]

  if (recipe.flourExcess > OVERFLOW_TOLERANCE) {
    warnings.push({ code: 'flour-overflow', excess: recipe.flourExcess, sources: recipe.flourUsed })
  }
  if (recipe.waterExcess > OVERFLOW_TOLERANCE) {
    warnings.push({ code: 'water-overflow', excess: recipe.waterExcess, sources: recipe.waterUsed })
  }

  const components: HeatComponent[] = [
    {
      dry: main.flour + main.salt + main.yeast + main.malt,
      water: 0,
      temp: state.mixing.flourTemp,
    },
    ...(starter
      ? [{ dry: starter.flourInDough, water: starter.waterInDough, temp: state.starter.temp }]
      : []),
    ...recipe.vorteige.map((v) => ({ dry: v.flour + v.yeast, water: v.water, temp: v.temp })),
    ...recipe.soakers.map((s) => ({ dry: s.dry, water: s.water, temp: state.mixing.flourTemp })),
  ]
  const waterTemp = calcWaterTemperature({
    targetTemp: state.fermentation.roomTemp,
    frictionRise: state.mixing.frictionRise,
    waterMass: main.water,
    components,
  })
  if (waterTemp !== null && (waterTemp < WATER_TEMP_MIN || waterTemp > WATER_TEMP_MAX)) {
    warnings.push({ code: 'water-temp-out-of-range', waterTemp })
  }

  if (lv.sourdoughPercent > SOURDOUGH_PERCENT_MAX) {
    warnings.push({ code: 'sourdough-implausible', percent: lv.sourdoughPercent })
  }
  if (lv.yeastPercent > YEAST_PERCENT_MAX) {
    warnings.push({ code: 'yeast-implausible', percent: lv.yeastPercent, vorteigId: null })
  }
  for (const v of recipe.vorteige) {
    if (v.yeastPercent > YEAST_PERCENT_MAX) {
      warnings.push({ code: 'yeast-implausible', percent: v.yeastPercent, vorteigId: v.id })
    }
  }
  const altbrotPercent = sumBy(
    state.soakers.filter((s) => s.kind === 'bread'),
    (s) => s.dryPercent,
  )
  if (altbrotPercent > ALTBROT_PERCENT_MAX) {
    warnings.push({ code: 'altbrot-high', percent: altbrotPercent })
  }

  const schedule = buildSchedule({
    bakeTime: state.bakeTime,
    roomHours: lv.roomHours,
    fridgeHours: state.fermentation.fridgeHours,
    proofHours: state.fermentation.proofHours,
    starterHours: starter ? starterProfile.ripeningHours : null,
    vorteige: recipe.vorteige.map((v) => ({ id: v.id, hours: v.hours })),
    hasSoakers: recipe.soakers.length > 0,
  })

  const countedFlour = main.flour + sumSources(recipe.flourUsed)
  const countedWater = main.water + sumSources(recipe.waterUsed)
  const hydration = countedFlour > 0 ? (100 * countedWater) / countedFlour : 0
  const pieces = state.sizingMode === 'pieces'

  return {
    totalFlour,
    doughWeight: recipe.doughWeight,
    summary: {
      doughWeight: recipe.doughWeight,
      hydration,
      hydrationInclSeedWater:
        countedFlour > 0 ? (100 * (countedWater + recipe.boundSeedWater)) / countedFlour : 0,
      ta: 100 + hydration,
      prefermentedFlourPercent:
        totalFlour > 0
          ? (100 * (recipe.flourUsed.starter + recipe.flourUsed.vorteige)) / totalFlour
          : 0,
      pieceCount: pieces ? state.pieceCount : null,
      pieceWeight: pieces ? state.pieceWeight : null,
    },
    leavening: lv,
    starterProfile,
    starter,
    vorteige: recipe.vorteige,
    soakers: recipe.soakers,
    main,
    waterTemperature: {
      targetTemp: state.fermentation.roomTemp,
      frictionRise: state.mixing.frictionRise,
      waterTemp,
    },
    schedule,
    warnings,
  }
}

export interface SoakerTarget {
  /** null für eine neue Einlage. */
  id: string | null
  kind: SoakerKind
  waterRatio: number
}

/**
 * Trockenmasse in % vom Gesamtmehl, die `grams` Trockenmasse ergibt. Im Teiglings-Modus ändern
 * Saaten das Teiggewicht und damit das Gesamtmehl; deshalb wird exakt aufgelöst.
 * null, wenn die Menge nicht erreichbar ist.
 */
export const soakerDryPercentForGrams = (
  input: DoughState,
  target: SoakerTarget,
  grams: number,
): number | null => {
  if (!(grams >= 0) || !Number.isFinite(grams)) return null
  const state = sanitizeState(input)
  const maxPercent: number = FIELDS.soakerDryPercent.max

  if (state.sizingMode === 'flour') {
    const percent = (100 * grams) / state.totalFlour
    return percent <= maxPercent ? percent : null
  }
  if (grams === 0) return 0

  const leavening = calcLeavening(state)
  const exists = target.id !== null && state.soakers.some((s) => s.id === target.id)
  const gramsAt = (dryPercent: number): number => {
    const soaker = {
      id: target.id ?? '__new__',
      kind: target.kind,
      dryPercent,
      waterRatio: target.waterRatio,
    }
    const soakers = exists
      ? state.soakers.map((s) => (s.id === target.id ? soaker : s))
      : [...state.soakers, soaker]
    return (resolveTotalFlour({ ...state, soakers }, leavening) * dryPercent) / 100
  }

  if (gramsAt(maxPercent) < grams) return null
  let low = 0
  let high = maxPercent
  for (let i = 0; i < 100 && high - low > 1e-12; i++) {
    const mid = (low + high) / 2
    if (gramsAt(mid) >= grams) high = mid
    else low = mid
  }
  return (low + high) / 2
}
