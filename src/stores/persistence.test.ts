import { describe, expect, it } from 'vitest'
import { createDefaultState } from '@/utils/schema'
import { SCHEMA_VERSION, migrateV1ToV2, restoreState, serializeState } from './persistence'

/** So hat v1 seinen Default-State gespeichert. */
const v1Defaults = () => ({
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
    leaveningContribution: 1,
  },
  vorteige: [] as unknown[],
  soakers: [] as unknown[],
})

describe('serialize / restore', () => {
  it('round-trips a v2 state', () => {
    const state = createDefaultState()
    state.targetHydration = 78
    state.soakers = [{ id: 's1', kind: 'oats', dryPercent: 7.5, waterRatio: 2 }]
    const raw = serializeState(state)
    expect(JSON.parse(raw).schemaVersion).toBe(SCHEMA_VERSION)
    expect(restoreState(raw, null)).toEqual(state)
  })

  it('sanitizes broken v2 data instead of crashing', () => {
    const state = { ...createDefaultState(), totalFlour: '', starter: { reserve: '' } }
    const restored = restoreState(serializeState(state), null)
    expect(restored.totalFlour).toBe(1000)
    expect(restored.starter.reserve).toBe(25)
  })

  it('falls back to defaults for unknown or broken data', () => {
    const defaults = createDefaultState()
    expect(restoreState(JSON.stringify({ schemaVersion: 3, state: {} }), null)).toEqual(defaults)
    expect(restoreState('{not json', 1)).toEqual(defaults)
    expect(restoreState('null', 1)).toEqual(defaults)
    expect(restoreState(JSON.stringify(v1Defaults()), null)).toEqual(defaults)
  })
})

describe('migrateV1ToV2', () => {
  it('keeps the user values and maps the old fields', () => {
    const state = migrateV1ToV2(v1Defaults())
    expect(state.targetHydration).toBe(80)
    expect(state.fermentation.mode).toBe('amount')
    expect(state.fermentation.sourdoughShare).toBe(100)
    expect(state.starter).toMatchObject({ preset: 'stiff', percent: 20, flour: 5, water: 3 })
    expect(state.maltType).toBe('active')
    expect(state.bakeTime).toBe('18:00')
  })

  it('converts the Vorteig yeast to the Vorteig flour', () => {
    const v1 = v1Defaults()
    v1.vorteige = [
      { id: 'p', type: 'poolish', flourPercent: 30, hydration: 100, yeastPercent: 0.03 },
      { id: 'b', type: 'biga', flourPercent: 30, hydration: 50, yeastPercent: 0.2 },
    ]
    const [poolish, biga] = migrateV1ToV2(v1).vorteige
    expect(poolish?.yeastPercent).toBeCloseTo(0.1, 9)
    expect(biga?.yeastPercent).toBeCloseTo(0.666667, 5)
    expect(poolish?.id).toBe('p')
  })

  it('converts soaker grams to percent and ratio', () => {
    const v1 = v1Defaults()
    v1.soakers = [
      { id: 'a', kind: 'sunflower', dry: 40, water: 20 },
      { id: 'b', kind: 'flour', dry: 0, water: 100 },
      { id: 'c', kind: 'grain', dry: 50, water: 50 },
      { id: 'd', kind: 'Cooked', dry: 50, water: 50 },
    ]
    const soakers = migrateV1ToV2(v1).soakers
    expect(soakers).toEqual([
      { id: 'a', kind: 'sunflower', dryPercent: 4, waterRatio: 0.5 },
      { id: 'b', kind: 'flour', dryPercent: 0, waterRatio: 5 },
      { id: 'c', kind: 'sunflower', dryPercent: 5, waterRatio: 1 },
    ])
  })

  it('repairs the empty values that bricked v1', () => {
    const v1 = v1Defaults()
    Object.assign(v1, { totalFlour: '' })
    Object.assign(v1.starter, { reserve: '', water: '' })
    v1.soakers = [{ id: 'a', kind: 'sunflower', dry: 40, water: '' }]
    const state = migrateV1ToV2(v1)
    expect(state.totalFlour).toBe(1000)
    expect(state.starter.reserve).toBe(25)
    expect(state.starter.water).toBe(3)
    expect(state.soakers[0]).toMatchObject({ dryPercent: 4, waterRatio: 0 })
  })

  it('maps the leavening split and time mode', () => {
    const v1 = v1Defaults()
    v1.fermentation = { ...v1.fermentation, mode: 'time', leaveningContribution: 0.8 }
    const state = migrateV1ToV2(v1)
    expect(state.fermentation.mode).toBe('time')
    expect(state.fermentation.sourdoughShare).toBe(80)
  })

  it('is used by restoreState for legacy version 1', () => {
    const state = restoreState(JSON.stringify(v1Defaults()), 1)
    expect(state.targetHydration).toBe(80)
  })
})
