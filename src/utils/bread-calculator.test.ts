import { describe, expect, it } from 'vitest'
import {
  MALT_ACCEL_PER_PERCENT,
  STARTER_K,
  YEAST_K,
  calcFermentationLeavening,
  calculateDough,
} from './bread-calculator'
import type { DoughState } from '@/types/bread'

// Minimal valid state used across tests
const baseState = (): DoughState => ({
  totalFlour: 1000,
  targetHydration: 80,
  saltPercent: 2.2,
  yeastPercent: 0,
  maltPercent: 0,
  starter: { percent: 20, flour: 5, water: 3, reserve: 25 },
  fermentation: {
    mode: 'manual',
    roomHours: 8,
    roomTemp: 21,
    fridgeHours: 0,
    fridgeTemp: 5,
    leaveningContribution: 1.0,
  },
  vorteige: [],
  soakers: [],
})

describe('calcFermentationLeavening', () => {
  it('computes starter percent from time at reference temp (no malt)', () => {
    const s = {
      mode: 'time' as const,
      roomHours: 8,
      roomTemp: 24,   // T_REF → rate = 1.0
      fridgeHours: 0,
      fridgeTemp: 5,
      leaveningContribution: 1.0,
    }
    // effST = 8 * 1 = 8 → starterPercent = STARTER_K / 8
    const result = calcFermentationLeavening(s, 0)
    expect(result.starterPercent).toBeCloseTo(STARTER_K / 8, 5)
    expect(result.yeastPercent).toBe(0)  // leaveningContribution = 1 → no yeast
  })

  it('splits leavening between starter and yeast', () => {
    const s = {
      mode: 'time' as const,
      roomHours: 8,
      roomTemp: 24,
      fridgeHours: 0,
      fridgeTemp: 5,
      leaveningContribution: 0.5,
    }
    const result = calcFermentationLeavening(s, 0)
    expect(result.starterPercent).toBeCloseTo((0.5 * STARTER_K) / 8, 5)
    expect(result.yeastPercent).toBeCloseTo((0.5 * YEAST_K) / 8, 5)
  })

  it('malt accelerates fermentation (reduces required leavening)', () => {
    const s = {
      mode: 'time' as const,
      roomHours: 8,
      roomTemp: 24,
      fridgeHours: 0,
      fridgeTemp: 5,
      leaveningContribution: 1.0,
    }
    const noMalt = calcFermentationLeavening(s, 0)
    const withMalt = calcFermentationLeavening(s, 1)
    // 1% malt → 15% acceleration → lower starter% needed
    expect(withMalt.starterPercent).toBeCloseTo(noMalt.starterPercent / (1 + MALT_ACCEL_PER_PERCENT), 5)
  })

  it('returns 0 for starter when leaveningContribution is 0', () => {
    const s = {
      mode: 'time' as const,
      roomHours: 8,
      roomTemp: 24,
      fridgeHours: 0,
      fridgeTemp: 5,
      leaveningContribution: 0,
    }
    const result = calcFermentationLeavening(s, 0)
    expect(result.starterPercent).toBe(0)
    expect(result.yeastPercent).toBeCloseTo(YEAST_K / 8, 5)
  })

  it('returns 0 for both when hours are 0', () => {
    const s = {
      mode: 'time' as const,
      roomHours: 0,
      roomTemp: 21,
      fridgeHours: 0,
      fridgeTemp: 5,
      leaveningContribution: 1.0,
    }
    const result = calcFermentationLeavening(s, 0)
    expect(result.starterPercent).toBe(0)
    expect(result.yeastPercent).toBe(0)
  })
})

describe('calculateDough — starter feeding', () => {
  it('computes feeding amounts for default state', () => {
    // 1000g flour, 20% starter, 5:3 ratio, 25g reserve
    // flourInDough = 200g, totalParts = 9, forRecipe = 200*(9/5) = 360g
    // total = 385g, seed = 385/9 ≈ 42.78g
    const r = calculateDough(baseState())
    expect(r.starterFeeding.total).toBeCloseTo(385, 0)
    expect(r.starterFeeding.forRecipe).toBeCloseTo(360, 0)
    expect(r.starterFeeding.seed).toBeCloseTo(385 / 9, 4)
    expect(r.starterFeeding.flour).toBeCloseTo((385 / 9) * 5, 4)
    expect(r.starterFeeding.water).toBeCloseTo((385 / 9) * 3, 4)
  })
})

describe('calculateDough — main dough water and flour', () => {
  it('main flour + starter flour = total flour', () => {
    const r = calculateDough(baseState())
    const flourInStarter = 1000 * 0.20
    expect(r.flourMain).toBeCloseTo(1000 - flourInStarter, 4)
  })

  it('effective hydration equals target when no soakers', () => {
    const r = calculateDough(baseState())
    expect(r.effectiveHydration).toBeCloseTo(0.80, 4)
  })

  it('waterMain accounts for water already in starter', () => {
    const r = calculateDough(baseState())
    // waterInStarter = 200 * (3/5) = 120
    // targetWater = 1000 * 0.8 = 800
    // waterMain = 800 - 120 = 680
    expect(r.waterMain).toBeCloseTo(680, 0)
  })
})

describe('calculateDough — salt, yeast, malt', () => {
  it('calculates salt by percent', () => {
    const r = calculateDough(baseState())
    expect(r.salt).toBeCloseTo(22, 1)
  })

  it('zero yeast when yeastPercent is 0', () => {
    const r = calculateDough(baseState())
    expect(r.yeast).toBe(0)
  })

  it('calculates malt from percent', () => {
    const state = baseState()
    state.maltPercent = 1
    const r = calculateDough(state)
    expect(r.malt).toBeCloseTo(10, 1)
  })
})

describe('calculateDough — vorteige', () => {
  it('subtracts vorteig flour and water from main dough', () => {
    const state = baseState()
    state.vorteige = [
      {
        id: 'v1',
        type: 'poolish',
        flourPercent: 30,
        hydration: 100,
        yeastPercent: 0.03,
        fermentationHours: 12,
        fermentationTemp: 20,
      },
    ]
    const r = calculateDough(state)
    // vorteig flour = 1000 * 0.3 = 300, water = 300
    expect(r.vorteigResults).toHaveLength(1)
    expect(r.vorteigResults[0]!.flour).toBeCloseTo(300, 4)
    expect(r.vorteigResults[0]!.water).toBeCloseTo(300, 4)
    // flourInStarter = 200, flourMain = 1000 - 200 - 300 = 500
    expect(r.flourMain).toBeCloseTo(500, 0)
  })

  it('auto-calculates vorteig yeast in time mode', () => {
    const state = baseState()
    state.fermentation.mode = 'time'
    state.fermentation.roomHours = 8
    state.fermentation.leaveningContribution = 1.0
    state.vorteige = [
      {
        id: 'v1',
        type: 'poolish',
        flourPercent: 30,
        hydration: 100,
        yeastPercent: 0,   // ignored in time mode
        fermentationHours: 12,
        fermentationTemp: 20,
      },
    ]
    const r = calculateDough(state)
    expect(r.vorteigResults[0]!.yeastPercent).toBeGreaterThan(0)
  })
})

describe('calculateDough — soakers', () => {
  it('flour soaker contributes its dry weight to flourUsed', () => {
    const state = baseState()
    state.soakers = [{ id: 's1', kind: 'flour', dry: 50, water: 250 }]
    const r = calculateDough(state)
    // flourInStarter = 200, soaker flour = 50 → flourMain = 1000 - 200 - 50 = 750
    expect(r.flourMain).toBeCloseTo(750, 0)
  })

  it('seed soaker water is fully absorbed (freeWaterFraction = 0)', () => {
    const state = baseState()
    state.soakers = [{ id: 's1', kind: 'sunflower', dry: 50, water: 25 }]
    const rWithout = calculateDough(baseState())
    const rWith = calculateDough(state)
    // sunflower freeWaterFraction = 0 → doesn't reduce main water
    // but actual water is higher → effectiveHydration changes
    expect(rWith.waterMain).toBeCloseTo(rWithout.waterMain, 0)
    expect(rWith.effectiveHydration).toBeGreaterThan(rWithout.effectiveHydration)
  })

  it('flour soaker free water reduces main dough water', () => {
    const state = baseState()
    // flour soaker freeWaterFraction = 1.0
    state.soakers = [{ id: 's1', kind: 'flour', dry: 100, water: 500 }]
    const r = calculateDough(state)
    // waterInStarter = 120, soaker free water = 500 * 1.0 = 500
    // waterMain = 800 - 120 - 500 = 180
    expect(r.waterMain).toBeCloseTo(180, 0)
  })
})

describe('calculateDough — yeastInfo', () => {
  it('detects vorteig yeast over-supply in time mode', () => {
    const state = baseState()
    state.fermentation.mode = 'time'
    state.fermentation.roomHours = 8
    state.fermentation.leaveningContribution = 0.0  // only yeast
    // Add a vorteig with very fast fermentation → very high yeast percent
    state.vorteige = [
      {
        id: 'v1',
        type: 'poolish',
        flourPercent: 100,
        hydration: 100,
        yeastPercent: 0,
        fermentationHours: 0.1, // very short → very high yeast%
        fermentationTemp: 24,
      },
    ]
    const r = calculateDough(state)
    expect(r.yeastInfo.vorteigOverSuppliesYeast).toBe(true)
  })

  it('returns null estimatedYeastHours when no yeast', () => {
    const state = baseState()
    state.yeastPercent = 0
    const r = calculateDough(state)
    expect(r.yeastInfo.estimatedYeastHours).toBeNull()
  })
})
