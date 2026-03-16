import type { DoughState } from '@/types/bread'

const starterFlourWater = (weight: number, hydration: number) => {
  const flour = weight / (1 + hydration)
  const water = weight - flour
  return { flour, water }
}

const calculateHydrationFromParts = (flourParts: number, waterParts: number) => {
  if (flourParts === 0) throw new Error('Flour parts cannot be zero')
  return (waterParts / flourParts) * 100
}

const calculateStarterSeed = (weight: number, flourParts: number, waterParts: number) => {
  const totalParts = flourParts + waterParts + 1

  return weight / totalParts
}

export const calculateDough = (state: DoughState) => {
  const starterWeight = state.totalFlour * (state.starter.percent / 100) + state.starter.reserve
  // const starterHydration = calculateHydrationFromParts(state.starter.flour, state.starter.water)
  // const starter = starterFlourWater(starterWeight, starterHydration / 100)

  const feedSeed = calculateStarterSeed(starterWeight, state.starter.flour, state.starter.water)
  const starterForRecipe = starterWeight - state.starter.reserve

  const feedFlour = feedSeed * state.starter.flour
  const feedWater = feedSeed * state.starter.water

  let flourUsed = feedFlour
  let waterUsed = feedWater

  for (const s of state.soakers) {
    flourUsed += s.flour
    waterUsed += s.water
  }

  const totalFlour = state.totalFlour
  const targetWater = totalFlour * (state.targetHydration / 100)

  const flourMain = totalFlour - flourUsed
  const waterMain = targetWater - waterUsed

  return {
    starterWeight,
    starterFeeding: {
      total: starterWeight,
      forRecipe: starterForRecipe,
      seed: feedSeed,
      flour: feedFlour,
      water: feedWater,
    },
    flourMain,
    waterMain,
    salt: totalFlour * (state.saltPercent / 100),
    yeast: totalFlour * (state.yeastPercent / 100),
    malt: totalFlour * (state.maltPercent / 100),
    effectiveHydration: (waterUsed + waterMain) / totalFlour,
  }
}
