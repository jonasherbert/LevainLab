import { describe, expect, it } from 'vitest'
import type { DoughState } from '@/types/dough'
import { createDefaultState, createVorteig } from './schema'
import {
  SOURDOUGH_REF,
  YEAST_REF,
  VORTEIG_REFS,
  calcLeavening,
  fermentationRate,
  fridgeEffectiveHours,
  maltFactor,
  readyEffHours,
  requiredPercent,
  starterRipeningHours,
  starterSeedFlourFraction,
  vorteigHoursForYeast,
  vorteigYeastForHours,
} from './fermentation'

const timeState = (patch: Partial<DoughState['fermentation']> = {}): DoughState => {
  const state = createDefaultState()
  state.fermentation = { ...state.fermentation, mode: 'time', ...patch }
  return state
}

describe('fermentationRate', () => {
  it('is 1 at the reference temperature and follows Q10', () => {
    expect(fermentationRate('sourdough', 24)).toBe(1)
    expect(fermentationRate('sourdough', 21)).toBeCloseTo(0.659754, 6)
    expect(fermentationRate('yeast', 21)).toBeCloseTo(0.719223, 6)
    expect(fermentationRate('sourdough', 5)).toBeCloseTo(0.0717936, 6)
  })

  it('caps the model temperature at 35 °C', () => {
    expect(fermentationRate('sourdough', 50)).toBeCloseTo(fermentationRate('sourdough', 35), 9)
  })
})

describe('fridgeEffectiveHours', () => {
  it('counts the cool-down phase', () => {
    expect(fridgeEffectiveHours('sourdough', 12, 21, 5)).toBeCloseTo(1.497293, 5)
    expect(fridgeEffectiveHours('yeast', 12, 21, 5)).toBeCloseTo(2.22323, 5)
    expect(fridgeEffectiveHours('sourdough', 48, 21, 5)).toBeCloseTo(4.08265, 4)
    // ohne Abkühlung wären es nur 12 h × 0,0718 = 0,86 h
    expect(fridgeEffectiveHours('sourdough', 12, 21, 5)).toBeGreaterThan(
      12 * fermentationRate('sourdough', 5),
    )
  })

  it('equals the constant rate when the dough is already cold', () => {
    expect(fridgeEffectiveHours('sourdough', 10, 5, 5)).toBeCloseTo(0.717936, 6)
    expect(fridgeEffectiveHours('sourdough', 0, 21, 5)).toBe(0)
  })
})

describe('power law', () => {
  it('reproduces the reference points', () => {
    expect(requiredPercent(SOURDOUGH_REF, 4.55)).toBeCloseTo(20, 9)
    expect(YEAST_REF.effHours).toBeCloseTo(5.753785, 6)
    expect(VORTEIG_REFS.poolish.effHours).toBeCloseTo(7.732728, 6)
    expect(VORTEIG_REFS.biga.effHours).toBeCloseTo(9.311073, 6)
  })

  it('estimates realistic yeast times', () => {
    expect(readyEffHours(YEAST_REF, 1)).toBeCloseTo(2.494782, 5)
    expect(readyEffHours(YEAST_REF, 2.5)).toBeCloseTo(1.577838, 5)
    expect(readyEffHours(YEAST_REF, 0.1)! / fermentationRate('yeast', 20)).toBeCloseTo(12.2428, 3)
  })

  it('needs less sourdough for longer times, but not proportionally', () => {
    expect(requiredPercent(SOURDOUGH_REF, 8 * fermentationRate('sourdough', 21))).toBeCloseTo(
      13.8,
      3,
    )
    expect(requiredPercent(SOURDOUGH_REF, 12 * fermentationRate('sourdough', 20))).toBeCloseTo(
      7.082154,
      5,
    )
  })

  it('returns null without time or amount', () => {
    expect(requiredPercent(SOURDOUGH_REF, 0)).toBeNull()
    expect(readyEffHours(YEAST_REF, 0)).toBeNull()
  })
})

describe('malt', () => {
  it('only active malt accelerates, capped at 3 %', () => {
    expect(maltFactor(1, 'active')).toBeCloseTo(1.15, 9)
    expect(maltFactor(1, 'inactive')).toBe(1)
    expect(maltFactor(10, 'active')).toBeCloseTo(1.45, 9)
  })
})

describe('Vorteige', () => {
  it('reproduces the type defaults', () => {
    expect(vorteigYeastForHours('poolish', 12, 20)).toBeCloseTo(0.1, 9)
    expect(vorteigYeastForHours('biga', 18, 18)).toBeCloseTo(1, 9)
    expect(vorteigHoursForYeast('poolish', 0.1, 20)).toBeCloseTo(12, 9)
    expect(vorteigHoursForYeast('biga', 1, 18)).toBeCloseTo(18, 9)
  })

  it('scales yeast with time', () => {
    expect(vorteigYeastForHours('poolish', 16, 20)).toBeCloseTo(0.05625, 6)
    expect(vorteigYeastForHours('poolish', 8, 20)).toBeCloseTo(0.225, 6)
    expect(vorteigYeastForHours('poolish', 0, 20)).toBeNull()
    expect(vorteigHoursForYeast('biga', 0, 18)).toBeNull()
  })
})

describe('starter ripening', () => {
  it('depends on feeding ratio and temperature', () => {
    expect(starterSeedFlourFraction(5, 3)).toBeCloseTo(1 / 9, 12)
    expect(starterRipeningHours(5, 3, 21)).toBeCloseTo(11.504778, 5)
    expect(starterRipeningHours(5, 4, 21)).toBeCloseTo(12, 5)
    expect(starterRipeningHours(1, 1, 24)).toBeCloseTo(4.891159, 5)
    expect(starterRipeningHours(10, 10, 24)).toBeCloseTo(10.652486, 5)
  })
})

describe('calcLeavening – time mode', () => {
  it('computes VG and yeast from the schedule and the split', () => {
    expect(calcLeavening(timeState()).leavening.sourdoughPercent).toBeCloseTo(13.799982, 5)
    const half = calcLeavening(timeState({ sourdoughShare: 50 })).leavening
    expect(half.sourdoughPercent).toBeCloseTo(6.899991, 5)
    expect(half.yeastPercent).toBeCloseTo(0.094, 6)
    const yeastOnly = calcLeavening(timeState({ sourdoughShare: 0 })).leavening
    expect(yeastOnly.sourdoughPercent).toBe(0)
    expect(yeastOnly.yeastPercent).toBeCloseTo(0.188, 9)
    expect(yeastOnly.usesSourdough).toBe(false)
  })

  it('counts the fridge phase including the cool-down', () => {
    const lev = calcLeavening(
      timeState({ roomHours: 4, roomTemp: 24, fridgeHours: 14, fridgeTemp: 4 }),
    ).leavening
    expect(lev.sourdoughPercent).toBeCloseTo(11.18856, 4)
  })

  it('applies active malt only', () => {
    const active = timeState()
    active.maltPercent = 1
    const inactive = timeState()
    inactive.maltPercent = 1
    inactive.maltType = 'inactive'
    expect(calcLeavening(active).leavening.sourdoughPercent).toBeCloseTo(9.730472, 5)
    expect(calcLeavening(inactive).leavening.sourdoughPercent).toBeCloseTo(13.799982, 5)
  })

  it('reduces the starter by the progress of the Vorteig yeast', () => {
    const state = timeState()
    state.vorteige = [createVorteig('poolish', 'v1')]
    const result = calcLeavening(state)
    expect(result.vorteige[0]?.yeastPercent).toBeCloseTo(0.1, 9)
    expect(result.leavening.sourdoughPercent).toBeCloseTo(11.597857, 5)
    expect(result.leavening.progress?.vorteige).toBeCloseTo(0.159574, 5)
    expect(result.warnings).toEqual([])
  })

  it('warns when the Vorteige alone ferment faster than planned', () => {
    const state = timeState()
    state.vorteige = [createVorteig('biga', 'b1')]
    const result = calcLeavening(state)
    expect(result.leavening.sourdoughPercent).toBe(0)
    expect(result.leavening.yeastPercent).toBe(0)
    expect(result.warnings).toEqual([
      { code: 'vorteig-oversupply', plannedHours: 8, estimatedHours: expect.closeTo(6.332982, 4) },
    ])
  })

  it('warns instead of dividing by zero without fermentation time', () => {
    const result = calcLeavening(timeState({ roomHours: 0 }))
    expect(result.leavening.sourdoughPercent).toBe(0)
    expect(result.leavening.yeastPercent).toBe(0)
    expect(result.warnings.map((w) => w.code)).toEqual(['no-fermentation-time'])
  })

  it('flags a Vorteig without time', () => {
    const state = timeState()
    state.vorteige = [{ ...createVorteig('poolish', 'v1'), fermentationHours: 0 }]
    const result = calcLeavening(state)
    expect(result.vorteige[0]).toEqual({ id: 'v1', yeastPercent: 0, hours: null })
    expect(result.warnings).toContainEqual({ code: 'vorteig-no-time', vorteigId: 'v1' })
  })
})

describe('calcLeavening – amount mode', () => {
  it('estimates the room hours', () => {
    const lev = calcLeavening(createDefaultState()).leavening
    expect(lev.roomHours).toBeCloseTo(6.89651, 5)
    expect(lev.progress?.sourdough).toBeCloseTo(1, 9)
    expect(lev.sourdoughShare).toBeCloseTo(100, 9)
  })

  it('combines sourdough and yeast', () => {
    const state = createDefaultState()
    state.starter.percent = 10
    state.yeastPercent = 0.1
    state.fermentation.roomTemp = 24
    const lev = calcLeavening(state).leavening
    expect(lev.roomHours).toBeCloseTo(4.926728, 5)
    expect(lev.progress?.sourdough).toBeCloseTo(0.610011, 5)
    expect(lev.progress?.yeast).toBeCloseTo(0.389989, 5)
    expect(lev.sourdoughShare).toBeCloseTo(61.0011, 3)
  })

  it('handles yeast only and no leavening', () => {
    const yeastOnly = createDefaultState()
    yeastOnly.starter.percent = 0
    yeastOnly.yeastPercent = 1
    yeastOnly.fermentation.roomTemp = 24
    expect(calcLeavening(yeastOnly).leavening.roomHours).toBeCloseTo(2.494782, 5)

    const none = createDefaultState()
    none.starter.percent = 0
    const result = calcLeavening(none)
    expect(result.leavening.roomHours).toBeNull()
    expect(result.warnings.map((w) => w.code)).toEqual(['no-leavening'])
  })

  it('reports when the fridge phase alone overproofs the dough', () => {
    const state = createDefaultState()
    state.fermentation.fridgeHours = 72
    const result = calcLeavening(state)
    expect(result.leavening.roomHours).toBe(0)
    expect(result.warnings[0]?.code).toBe('fridge-overproof')

    state.fermentation.fridgeHours = 12
    expect(calcLeavening(state).leavening.roomHours).toBeCloseTo(4.627038, 4)
  })

  it('estimates the Vorteig time and counts its yeast', () => {
    const state = createDefaultState()
    state.vorteige = [createVorteig('poolish', 'v1')]
    const result = calcLeavening(state)
    expect(result.vorteige[0]?.hours).toBeCloseTo(12, 9)
    expect(result.leavening.roomHours).toBeCloseTo(6.58772, 4)
    expect(result.leavening.progress?.vorteige).toBeCloseTo(0.108207, 5)
  })

  it('flags a Vorteig without yeast', () => {
    const state = createDefaultState()
    state.vorteige = [{ ...createVorteig('poolish', 'v1'), yeastPercent: 0 }]
    const result = calcLeavening(state)
    expect(result.vorteige[0]?.hours).toBeNull()
    expect(result.warnings).toContainEqual({ code: 'vorteig-no-yeast', vorteigId: 'v1' })
  })
})
