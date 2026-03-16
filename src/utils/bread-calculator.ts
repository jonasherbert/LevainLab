import type { DoughState } from '@/types/bread'

const starterFlourWater = (weight: number, hydration: number) => {
  const flour = weight / (1 + hydration)
  const water = weight - flour
  return { flour, water }
}

export const calculateDough = (state: DoughState) => {
  const starterWeight = state.totalFlour * (state.starter.percent / 100)
  const starter = starterFlourWater(starterWeight, state.starter.hydration / 100)

  let flourUsed = starter.flour
  let waterUsed = starter.water

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
    flourMain,
    waterMain,
    salt: totalFlour * (state.saltPercent / 100),
    yeast: totalFlour * (state.yeastPercent / 100),
    malt: totalFlour * (state.maltPercent / 100),
    effectiveHydration: (waterUsed + waterMain) / totalFlour,
  }
}
