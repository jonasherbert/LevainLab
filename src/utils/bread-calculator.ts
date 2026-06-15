import {
  soakerDefinitions,
  type DoughState,
  type FermentationSettings,
  type SoakerComponent,
  type Starter,
  type Vorteig,
} from '@/types/bread'

const Q10_SOURDOUGH = 4.0
const Q10_YEAST = 3.0
const T_REF = 24
export const STARTER_K = 91   // 20% ST × ~4.6 eff.h at 24°C
export const YEAST_K = 1.08   // calibrated: 1.88g/kg at 8h@21°C
export const MALT_ACCEL_PER_PERCENT = 0.15  // ~15% faster per 1% active malt

const fermentationRateSourdough = (tempC: number): number =>
  Math.pow(Q10_SOURDOUGH, (tempC - T_REF) / 10)

const fermentationRateYeast = (tempC: number): number =>
  Math.pow(Q10_YEAST, (tempC - T_REF) / 10)

const calcEffectiveHoursSourdough = (s: FermentationSettings): number =>
  s.roomHours * fermentationRateSourdough(s.roomTemp)
  + s.fridgeHours * fermentationRateSourdough(s.fridgeTemp)

const calcEffectiveHoursYeast = (s: FermentationSettings): number =>
  s.roomHours * fermentationRateYeast(s.roomTemp)
  + s.fridgeHours * fermentationRateYeast(s.fridgeTemp)

export const calcFermentationLeavening = (s: FermentationSettings, maltPercent: number) => {
  const maltAcceleration = 1 + maltPercent * MALT_ACCEL_PER_PERCENT
  const effST = calcEffectiveHoursSourdough(s) * maltAcceleration
  const effHefe = calcEffectiveHoursYeast(s) * maltAcceleration
  return {
    starterPercent: effST > 0 ? s.leaveningContribution * STARTER_K / effST : 0,
    yeastPercent: effHefe > 0 ? (1 - s.leaveningContribution) * YEAST_K / effHefe : 0,
  }
}

const resolveVorteigYeastPercent = (v: Vorteig, fermentation: FermentationSettings): number =>
  fermentation.mode === 'time'
    ? YEAST_K / (v.fermentationHours * fermentationRateYeast(v.fermentationTemp))
    : v.yeastPercent

const calcStarterFeeding = (totalFlour: number, starterPercent: number, starter: Starter) => {
  const flourInDough = totalFlour * (starterPercent / 100)
  const totalParts = starter.flour + starter.water + 1
  const forRecipe = flourInDough * (totalParts / starter.flour)
  const total = forRecipe + starter.reserve
  const seed = total / totalParts
  return {
    seed,
    flour: seed * starter.flour,
    water: seed * starter.water,
    forRecipe,
    total,
    flourInDough,
    waterInDough: flourInDough * (starter.water / starter.flour),
  }
}

const calcVorteigContributions = (
  vorteige: Vorteig[],
  totalFlour: number,
  fermentation: FermentationSettings,
) => {
  let flourUsed = 0
  let waterUsed = 0
  const results = vorteige.map((v) => {
    const flour = totalFlour * (v.flourPercent / 100)
    const water = flour * (v.hydration / 100)
    flourUsed += flour
    waterUsed += water
    const yeastPercent = resolveVorteigYeastPercent(v, fermentation)
    const yeast = totalFlour * (yeastPercent / 100)
    return { id: v.id, type: v.type, flour, water, yeast, yeastPercent, total: flour + water }
  })
  return { results, flourUsed, waterUsed }
}

const calcSoakerContributions = (soakers: SoakerComponent[]) => {
  let flourUsed = 0
  let freeWaterUsed = 0
  let actualWater = 0
  for (const s of soakers) {
    const def = soakerDefinitions.get(s.kind)!
    if (def.isFlour) flourUsed += s.dry
    freeWaterUsed += s.water * def.freeWaterFraction
    actualWater += s.water
  }
  return { flourUsed, freeWaterUsed, actualWater }
}

const calcYeastInfo = (
  yeastPercent: number,
  vorteigYeastPercent: number,
  fermented: ReturnType<typeof calcFermentationLeavening> | null,
  maltPercent: number,
  fermentation: FermentationSettings,
) => {
  const combinedYeastPercent = yeastPercent + vorteigYeastPercent
  const maltAcceleration = 1 + maltPercent * MALT_ACCEL_PER_PERCENT
  const estimatedYeastHours = combinedYeastPercent > 0
    ? YEAST_K / (combinedYeastPercent * fermentationRateYeast(fermentation.roomTemp) * maltAcceleration)
    : null
  return {
    combinedYeastPercent,
    estimatedYeastHours,
    vorteigOverSuppliesYeast: fermented !== null && vorteigYeastPercent > fermented.yeastPercent,
    targetHours: fermented !== null ? fermentation.roomHours + fermentation.fridgeHours : null,
  }
}

export const calculateDough = (state: DoughState) => {
  const fermented = state.fermentation.mode === 'time'
    ? calcFermentationLeavening(state.fermentation, state.maltPercent)
    : null

  const starterPercent = fermented?.starterPercent ?? state.starter.percent
  const rawYeastPercent = fermented?.yeastPercent ?? state.yeastPercent

  const starterFeeding = calcStarterFeeding(state.totalFlour, starterPercent, state.starter)
  const vorteig = calcVorteigContributions(state.vorteige, state.totalFlour, state.fermentation)
  const soakers = calcSoakerContributions(state.soakers)

  const totalVorteigYeastPercent = vorteig.results.reduce((sum, r) => sum + r.yeastPercent, 0)
  const yeastPercent = fermented
    ? Math.max(0, rawYeastPercent - totalVorteigYeastPercent)
    : rawYeastPercent

  const flourUsed = starterFeeding.flourInDough + vorteig.flourUsed + soakers.flourUsed
  const waterUsed = starterFeeding.waterInDough + vorteig.waterUsed + soakers.freeWaterUsed

  const targetWater = state.totalFlour * (state.targetHydration / 100)
  const flourMain = state.totalFlour - flourUsed
  const waterMain = targetWater - waterUsed

  return {
    starterFeeding,
    vorteigResults: vorteig.results,
    flourMain,
    waterMain,
    salt: state.totalFlour * (state.saltPercent / 100),
    yeast: state.totalFlour * (yeastPercent / 100),
    malt: state.totalFlour * (state.maltPercent / 100),
    yeastInfo: calcYeastInfo(yeastPercent, totalVorteigYeastPercent, fermented, state.maltPercent, state.fermentation),
  }
}
