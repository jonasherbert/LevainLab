import { describe, expect, it } from 'vitest'
import type { DoughState } from '@/types/dough'
import { calculateDough, calcStarterBuild, soakerDryPercentForGrams } from './dough-calculator'
import { FIELDS, createDefaultState, createSoaker, createVorteig } from './schema'

const state = (patch: (s: DoughState) => void = () => {}): DoughState => {
  const s = createDefaultState()
  patch(s)
  return s
}

describe('calculateDough – defaults', () => {
  const r = calculateDough(createDefaultState())

  it('builds the starter including the seed', () => {
    expect(r.starter).not.toBeNull()
    expect(r.starter?.flourInDough).toBeCloseTo(200, 9)
    expect(r.starter?.waterInDough).toBeCloseTo(120, 9)
    expect(r.starter?.forRecipe).toBeCloseTo(320, 9)
    expect(r.starter?.total).toBeCloseTo(345, 9)
    expect(r.starter?.seed).toBeCloseTo(38.333333, 5)
    expect(r.starter?.feedFlour).toBeCloseTo(191.666667, 5)
    expect(r.starter?.feedWater).toBeCloseTo(115, 9)
    expect(r.starterProfile.hydration).toBeCloseTo(60, 9)
    expect(r.starterProfile.ta).toBeCloseTo(160, 9)
    expect(r.starterProfile.ripeningHours).toBeCloseTo(11.504778, 5)
  })

  it('computes the main dough and summary', () => {
    expect(r.totalFlour).toBe(1000)
    expect(r.main).toEqual({ flour: 800, water: 630, salt: 22, yeast: 0, malt: 0, fat: 0 })
    expect(r.doughWeight).toBeCloseTo(1772, 9)
    expect(r.summary.hydration).toBeCloseTo(75, 9)
    expect(r.summary.ta).toBeCloseTo(175, 9)
    expect(r.summary.prefermentedFlourPercent).toBeCloseTo(20, 9)
    expect(r.waterTemperature.waterTemp).toBeCloseTo(17.299537, 5)
    expect(r.warnings).toEqual([])
  })

  it('plans the schedule', () => {
    expect(r.leavening.roomHours).toBeCloseTo(6.89651, 5)
    expect(r.schedule?.steps.map((s) => `${s.kind} ${s.dayOffset} ${s.time}`)).toEqual([
      'starter -1 23:35',
      'mix 0 11:05',
      'shape 0 16:30',
      'bake 0 18:00',
    ])
  })
})

describe('starter balance', () => {
  it('puts exactly VG × flour into the dough for every feeding ratio', () => {
    for (const [flour, water] of [
      [5, 3],
      [5, 5],
      [2, 2],
      [1, 1],
      [2, 1],
    ] as const) {
      const r = calculateDough(state((s) => Object.assign(s.starter, { flour, water })))
      const build = r.starter!
      // Mehl im Anstellgut (gleiche Hydration wie die Fütterung) + frisch gefüttertes Mehl
      const seedFlour = (build.seed * flour) / (flour + water)
      const flourInBuild = seedFlour + build.feedFlour
      expect((flourInBuild * build.forRecipe) / build.total).toBeCloseTo(200, 9)
      expect(r.main.flour + build.flourInDough).toBeCloseTo(1000, 9)
      expect(r.main.water + build.waterInDough).toBeCloseTo(750, 9)
    }
  })

  it('uses 400 g instead of 600 g starter for a 1:1:1 feed', () => {
    const r = calculateDough(state((s) => Object.assign(s.starter, { flour: 1, water: 1 })))
    expect(r.starter?.forRecipe).toBeCloseTo(400, 9)
    expect(r.starter?.seed).toBeCloseTo(141.666667, 5)
  })

  it('keeps the main dough and lowers the starter for 10 % VG', () => {
    const r = calculateDough(state((s) => (s.starter.percent = 10)))
    expect(r.main.flour).toBeCloseTo(900, 9)
    expect(r.starter?.forRecipe).toBeCloseTo(160, 9)
    expect(r.starter?.seed).toBeCloseTo(20.555556, 5)
    expect(r.starter?.feedFlour).toBeCloseTo(102.777778, 5)
    expect(r.starter?.feedWater).toBeCloseTo(61.666667, 5)
  })

  it('returns no starter without sourdough', () => {
    expect(calcStarterBuild(1000, 0, createDefaultState().starter)).toBeNull()
    const r = calculateDough(state((s) => ((s.starter.percent = 0), (s.yeastPercent = 1))))
    expect(r.starter).toBeNull()
    expect(r.main.flour).toBe(1000)
  })
})

describe('robustness', () => {
  it('ignores empty strings instead of concatenating them', () => {
    const broken = state((s) => {
      ;(s.starter as unknown as Record<string, unknown>).water = ''
      ;(s.starter as unknown as Record<string, unknown>).reserve = ''
    })
    const r = calculateDough(broken)
    expect(r.starter?.forRecipe).toBeCloseTo(320, 9)
    expect(typeof r.starter?.total).toBe('number')
  })

  it('never throws and returns only finite numbers or null', () => {
    const empty: Record<string, unknown> = {}
    const fill = (template: unknown, target: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
        if (typeof value === 'number') target[key] = ''
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
          target[key] = {}
          fill(value, target[key] as Record<string, unknown>)
        }
      }
    }
    fill(createDefaultState(), empty)
    const r = calculateDough(empty as unknown as DoughState)
    const invalid: string[] = []
    const collect = (value: unknown, path: string) => {
      if (typeof value === 'number' && !Number.isFinite(value)) invalid.push(path)
      else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) collect(child, `${path}.${key}`)
      }
    }
    collect(r, 'result')
    expect(invalid).toEqual([])
    expect(r.doughWeight).toBeCloseTo(1772, 9)
  })
})

describe('Vorteige', () => {
  it('uses the yeast relative to the Vorteig flour', () => {
    const r = calculateDough(state((s) => (s.vorteige = [createVorteig('poolish', 'v1')])))
    expect(r.vorteige[0]).toMatchObject({ flour: 300, water: 300, yeastPercent: 0.1 })
    expect(r.vorteige[0]?.yeast).toBeCloseTo(0.3, 9)
    expect(r.vorteige[0]?.total).toBeCloseTo(600.3, 9)
    expect(r.main.flour).toBeCloseTo(500, 9)
    expect(r.main.water).toBeCloseTo(330, 9)
  })

  it('computes 0.3 g instead of 1.4 g poolish yeast in time mode', () => {
    const r = calculateDough(
      state((s) => {
        s.fermentation.mode = 'time'
        s.vorteige = [{ ...createVorteig('poolish', 'v1'), yeastPercent: 0 }]
      }),
    )
    expect(r.vorteige[0]?.yeastPercent).toBeCloseTo(0.1, 9)
    expect(r.vorteige[0]?.yeast).toBeCloseTo(0.3, 9)
  })
})

describe('soakers', () => {
  const withSoaker = (
    kind: Parameters<typeof createSoaker>[0],
    dryPercent: number,
    ratio: number,
  ) =>
    calculateDough(
      state((s) => (s.soakers = [{ ...createSoaker(kind, 's1'), dryPercent, waterRatio: ratio }])),
    )

  it('counts grain soakers as flour and their water fully', () => {
    const r = withSoaker('flour', 5, 5)
    expect(r.main.flour).toBeCloseTo(750, 9)
    expect(r.main.water).toBeCloseTo(380, 9)
    const oats = withSoaker('oats', 10, 2)
    expect(oats.main.flour).toBeCloseTo(700, 9)
    expect(oats.main.water).toBeCloseTo(430, 9)
  })

  it('keeps seed soak water out of the hydration', () => {
    const r = withSoaker('sunflower', 5, 0.5)
    expect(r.main.flour).toBeCloseTo(800, 9)
    expect(r.main.water).toBeCloseTo(630, 9)
    expect(r.doughWeight).toBeCloseTo(1847, 9)
    expect(r.summary.hydration).toBeCloseTo(75, 9)
    expect(r.summary.hydrationInclSeedWater).toBeCloseTo(77.5, 9)
  })

  it('scales soakers with the flour', () => {
    const r = calculateDough(
      state((s) => {
        s.totalFlour = 500
        s.soakers = [{ ...createSoaker('flour', 's1'), dryPercent: 8, waterRatio: 5 }]
      }),
    )
    expect(r.soakers[0]?.dry).toBeCloseTo(40, 9)
    expect(r.soakers[0]?.water).toBeCloseTo(200, 9)
  })

  it('warns about too much Altbrot', () => {
    expect(withSoaker('bread', 16, 2).warnings.map((w) => w.code)).toContain('altbrot-high')
    expect(withSoaker('bread', 10, 2).warnings).toEqual([])
  })

  it('schedules no soaker step for soakers without amount', () => {
    const kinds = (r: ReturnType<typeof calculateDough>) => r.schedule?.steps.map((s) => s.kind)
    expect(kinds(withSoaker('sunflower', 5, 0.5))).toContain('soakers')
    expect(kinds(withSoaker('sunflower', 0, 0.5))).not.toContain('soakers')
  })
})

describe('overflow', () => {
  it('clips the main dough and reports the sources', () => {
    const r = calculateDough(
      state((s) => {
        s.targetHydration = 70
        s.starter = { ...s.starter, flour: 1, water: 1, percent: 30, preset: 'custom' }
        s.vorteige = [{ ...createVorteig('biga', 'b1'), flourPercent: 50, hydration: 50 }]
        s.soakers = [{ ...createSoaker('flour', 's1'), dryPercent: 30, waterRatio: 5 }]
      }),
    )
    expect(r.main.flour).toBe(0)
    expect(r.main.water).toBe(0)
    const flour = r.warnings.find((w) => w.code === 'flour-overflow')
    const water = r.warnings.find((w) => w.code === 'water-overflow')
    expect(flour).toMatchObject({ sources: { starter: 300, vorteige: 500, soakers: 300 } })
    expect(flour?.code === 'flour-overflow' && flour.excess).toBeCloseTo(100, 9)
    expect(water?.code === 'water-overflow' && water.excess).toBeCloseTo(1350, 9)
  })
})

describe('sizing by pieces', () => {
  /** Teiglings-Modus ohne Verlust, damit die Werte exakt der Eingabe entsprechen. */
  const pieces = (patch: (s: DoughState) => void = () => {}) =>
    state((s) => {
      s.sizingMode = 'pieces'
      s.lossPercent = 0
      patch(s)
    })

  it('derives the flour from the dough weight', () => {
    const r = calculateDough(pieces())
    expect(r.totalFlour).toBeCloseTo(1015.801354, 5)
    expect(r.doughWeight).toBeCloseTo(1800, 9)
    expect(r.summary.pieceCount).toBe(2)
  })

  it('adds the loss allowance to the dough weight', () => {
    const fivePieces = (s: DoughState) => {
      s.pieceCount = 5
      s.pieceWeight = 380
    }
    expect(calculateDough(pieces(fivePieces)).doughWeight).toBeCloseTo(1900, 9)
    const r = calculateDough(pieces((s) => (fivePieces(s), (s.lossPercent = 3))))
    expect(r.doughWeight).toBeCloseTo(1957, 9)
    expect(r.summary.lossPercent).toBe(3)
    expect(calculateDough(createDefaultState()).summary.lossPercent).toBeNull()
  })

  it('accounts for seeds and Vorteige', () => {
    const r = calculateDough(
      pieces((s) => {
        s.pieceCount = 3
        s.pieceWeight = 750
        s.vorteige = [createVorteig('poolish', 'v1')]
        s.soakers = [
          { ...createSoaker('sunflower', 's1'), dryPercent: 10, waterRatio: 0.5 },
          { ...createSoaker('flour', 's2'), dryPercent: 5, waterRatio: 5 },
        ]
      }),
    )
    expect(r.doughWeight).toBeCloseTo(2250, 9)
  })

  it('converts soaker grams exactly, also when seeds change the dough weight', () => {
    const base = pieces()
    const sunflower = { id: null, kind: 'sunflower' as const, waterRatio: 0.5 }
    const percent = soakerDryPercentForGrams(base, sunflower, 100)
    expect(percent).toBeCloseTo(10.739394, 5)
    const r = calculateDough({
      ...base,
      soakers: [{ id: 'n', kind: 'sunflower', dryPercent: percent!, waterRatio: 0.5 }],
    })
    expect(r.soakers[0]?.dry).toBeCloseTo(100, 6)
    expect(r.doughWeight).toBeCloseTo(1800, 6)

    const oats = { id: null, kind: 'oats' as const, waterRatio: 2 }
    expect(soakerDryPercentForGrams(base, oats, 100)).toBeCloseTo(9.844444, 5)
    expect(soakerDryPercentForGrams(createDefaultState(), oats, 100)).toBeCloseTo(10, 9)
    expect(soakerDryPercentForGrams(base, sunflower, 5000)).toBeNull()
  })

  it('keeps soaker grams exact with a loss allowance', () => {
    const base = pieces((s) => (s.lossPercent = 5))
    const sunflower = { id: null, kind: 'sunflower' as const, waterRatio: 0.5 }
    const percent = soakerDryPercentForGrams(base, sunflower, 100)
    const r = calculateDough({
      ...base,
      soakers: [{ id: 'n', kind: 'sunflower', dryPercent: percent!, waterRatio: 0.5 }],
    })
    expect(r.soakers[0]?.dry).toBeCloseTo(100, 6)
    expect(r.doughWeight).toBeCloseTo(1890, 6)
  })
})

describe('fat', () => {
  it('adds oil to the dough weight but not to the hydration', () => {
    const r = calculateDough(state((s) => (s.fatPercent = 5)))
    expect(r.main.fat).toBeCloseTo(50, 9)
    expect(r.main.water).toBeCloseTo(630, 9)
    expect(r.doughWeight).toBeCloseTo(1822, 9)
    expect(r.summary.hydration).toBeCloseTo(75, 9)
  })

  it('is part of the dough weight when sizing by pieces', () => {
    const r = calculateDough(
      state((s) => {
        s.sizingMode = 'pieces'
        s.pieceCount = 5
        s.pieceWeight = 380
        s.lossPercent = 0
        s.fatPercent = 3
      }),
    )
    expect(r.doughWeight).toBeCloseTo(1900, 9)
    expect(r.main.fat).toBeCloseTo((r.totalFlour * 3) / 100, 9)
  })
})

describe('mode round trip', () => {
  const roomHoursList = [0, 0.5, 3, 8, 14, 30]
  const roomTemps = [16, 21, 26, 34]
  const fridgeHoursList = [0, 12]
  const shares = [0, 35, 100]
  const malts = [0, 1.5]
  const poolishPercents = [0, 20]

  it('time → amount → time reproduces hours and amounts', () => {
    let checked = 0
    let oversupplied = 0
    for (const roomHours of roomHoursList)
      for (const roomTemp of roomTemps)
        for (const fridgeHours of fridgeHoursList)
          for (const sourdoughShare of shares)
            for (const maltPercent of malts)
              for (const poolish of poolishPercents) {
                if (roomHours === 0 && fridgeHours === 0) continue
                const timeState = state((s) => {
                  s.fermentation = {
                    ...s.fermentation,
                    mode: 'time',
                    roomHours,
                    roomTemp,
                    fridgeHours,
                    fridgeTemp: 4,
                    sourdoughShare,
                  }
                  s.maltPercent = maltPercent
                  s.vorteige = poolish
                    ? [{ ...createVorteig('poolish', 'p'), flourPercent: poolish }]
                    : []
                })
                const forward = calculateDough(timeState)
                if (forward.warnings.some((w) => w.code === 'vorteig-oversupply')) {
                  oversupplied++
                  continue
                }
                const lv = forward.leavening
                // außerhalb der Eingabegrenzen würde der Mengenmodus kappen
                if (lv.sourdoughPercent > FIELDS.starterPercent.max) continue
                if (lv.yeastPercent > FIELDS.yeastPercent.max) continue

                const amountState: DoughState = {
                  ...timeState,
                  yeastPercent: lv.yeastPercent,
                  starter: { ...timeState.starter, percent: lv.sourdoughPercent },
                  fermentation: { ...timeState.fermentation, mode: 'amount', roomHours: 99 },
                  vorteige: timeState.vorteige.map((v) => ({
                    ...v,
                    yeastPercent: forward.vorteige[0]!.yeastPercent,
                    fermentationHours: 99,
                  })),
                }
                const back = calculateDough(amountState)
                expect(back.leavening.roomHours!).toBeCloseTo(roomHours, 6)
                expect(back.vorteige[0]?.hours ?? 12).toBeCloseTo(12, 9)
                expect(back.main.flour).toBeCloseTo(forward.main.flour, 6)
                expect(back.main.water).toBeCloseTo(forward.main.water, 6)
                expect(back.main.yeast).toBeCloseTo(forward.main.yeast, 6)

                const again = calculateDough({
                  ...amountState,
                  fermentation: {
                    ...amountState.fermentation,
                    mode: 'time',
                    roomHours: back.leavening.roomHours!,
                    sourdoughShare: back.leavening.sourdoughShare,
                  },
                  vorteige: amountState.vorteige.map((v) => ({
                    ...v,
                    fermentationHours: back.vorteige[0]!.hours!,
                  })),
                })
                expect(again.leavening.sourdoughPercent).toBeCloseTo(lv.sourdoughPercent, 6)
                expect(again.leavening.yeastPercent).toBeCloseTo(lv.yeastPercent, 6)
                checked++
              }
    expect(checked).toBeGreaterThan(300)
    expect(oversupplied).toBeGreaterThan(0)
  })
})
