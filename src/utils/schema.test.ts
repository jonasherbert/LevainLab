import { describe, expect, it } from 'vitest'
import { matchStarterPreset } from '@/types/dough'
import { FIELDS, createDefaultState, sanitizeState } from './schema'

let counter = 0
const testId = () => `generated-${++counter}`

describe('sanitizeState', () => {
  it('keeps a valid state unchanged', () => {
    const state = createDefaultState()
    state.vorteige = [
      {
        id: 'v1',
        type: 'poolish',
        flourPercent: 30,
        hydration: 100,
        yeastPercent: 0.1,
        fermentationHours: 12,
        fermentationTemp: 20,
      },
    ]
    state.soakers = [{ id: 's1', kind: 'flour', dryPercent: 5, waterRatio: 5 }]
    expect(sanitizeState(state)).toEqual(state)
  })

  it('returns defaults for non-objects', () => {
    expect(sanitizeState(null)).toEqual(createDefaultState())
    expect(sanitizeState('x')).toEqual(createDefaultState())
    expect(sanitizeState([])).toEqual(createDefaultState())
  })

  it('replaces invalid numbers with defaults', () => {
    const result = sanitizeState({
      totalFlour: '',
      targetHydration: null,
      saltPercent: NaN,
      starter: { reserve: '', flour: 'abc' },
      fermentation: { roomHours: Infinity },
    })
    const defaults = createDefaultState()
    expect(result.totalFlour).toBe(defaults.totalFlour)
    expect(result.targetHydration).toBe(defaults.targetHydration)
    expect(result.saltPercent).toBe(defaults.saltPercent)
    expect(result.starter.reserve).toBe(defaults.starter.reserve)
    expect(result.starter.flour).toBe(defaults.starter.flour)
    expect(result.fermentation.roomHours).toBe(defaults.fermentation.roomHours)
  })

  it('clamps numbers to the field range', () => {
    const result = sanitizeState({
      targetHydration: 500,
      starter: { flour: 0 },
      fermentation: { sourdoughShare: 150, fridgeTemp: -40 },
    })
    expect(result.targetHydration).toBe(FIELDS.targetHydration.max)
    expect(result.starter.flour).toBe(FIELDS.starterFlour.min)
    expect(result.fermentation.sourdoughShare).toBe(100)
    expect(result.fermentation.fridgeTemp).toBe(FIELDS.fridgeTemp.min)
  })

  it('validates enums and the bake time', () => {
    const result = sanitizeState({
      sizingMode: 'loaves',
      maltType: 'roasted',
      fermentation: { mode: 'manual' },
      bakeTime: '25:00',
    })
    expect(result.sizingMode).toBe('flour')
    expect(result.maltType).toBe('active')
    expect(result.fermentation.mode).toBe('amount')
    expect(result.bakeTime).toBe('18:00')
    expect(sanitizeState({ bakeTime: '07:30' }).bakeTime).toBe('07:30')
  })

  it('drops unknown list items and fills invalid item fields from the type defaults', () => {
    const result = sanitizeState({
      vorteige: [
        { id: 'a', type: 'sponge' },
        { id: 'b', type: 'biga', yeastPercent: '' },
      ],
      soakers: [
        { id: 'c', kind: 'grain', dryPercent: 4, waterRatio: 1 },
        { id: 'd', kind: 'bread', dryPercent: 5, waterRatio: '' },
      ],
    })
    expect(result.vorteige).toHaveLength(1)
    expect(result.vorteige[0]?.yeastPercent).toBe(1)
    expect(result.soakers).toHaveLength(1)
    expect(result.soakers[0]?.waterRatio).toBe(2)
    expect(sanitizeState({ vorteige: 'x' }).vorteige).toEqual([])
  })

  it('repairs missing and duplicate ids', () => {
    const result = sanitizeState(
      {
        vorteige: [
          { id: 'same', type: 'poolish' },
          { id: 'same', type: 'biga' },
        ],
        soakers: [{ kind: 'sesame' }],
      },
      testId,
    )
    const ids = [...result.vorteige.map((v) => v.id), ...result.soakers.map((s) => s.id)]
    expect(new Set(ids).size).toBe(3)
    expect(ids[0]).toBe('same')
  })

  it('keeps the starter preset consistent with the feeding ratio', () => {
    expect(sanitizeState({ starter: { preset: 'stiff', flour: 5, water: 5 } }).starter.preset).toBe(
      'liquid',
    )
    expect(sanitizeState({ starter: { preset: 'stiff', flour: 4, water: 3 } }).starter.preset).toBe(
      'custom',
    )
    expect(
      sanitizeState({ starter: { preset: 'custom', flour: 5, water: 3 } }).starter.preset,
    ).toBe('custom')
    expect(matchStarterPreset(2, 1)).toBe('lievitoMadre')
  })

  it('does not mutate the input', () => {
    const input = { totalFlour: '', starter: { flour: 0 } }
    const copy = JSON.parse(JSON.stringify(input))
    sanitizeState(input)
    expect(input).toEqual(copy)
  })
})
