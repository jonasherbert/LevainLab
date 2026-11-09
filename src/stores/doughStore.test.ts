import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useDoughStore } from './doughStore'

const soakerResult = (store: ReturnType<typeof useDoughStore>, id: string) =>
  store.result.soakers.find((s) => s.id === id)!

describe('doughStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  describe('fermentation mode', () => {
    it('keeps the recipe when switching amount → time → amount', () => {
      const store = useDoughStore()
      store.addVorteig('poolish')
      const before = store.result
      store.setFermentationMode('time')
      expect(store.fermentation.roomHours).toBeCloseTo(before.leavening.roomHours!, 9)
      expect(store.result.leavening.sourdoughPercent).toBeCloseTo(20, 6)
      expect(store.result.main.water).toBeCloseTo(before.main.water, 6)
      store.setFermentationMode('amount')
      expect(store.starter.percent).toBeCloseTo(20, 6)
      expect(store.vorteige[0]?.yeastPercent).toBeCloseTo(0.1, 6)
    })

    it('ignores invalid modes', () => {
      const store = useDoughStore()
      store.setFermentationMode(undefined as never)
      expect(store.fermentation.mode).toBe('amount')
    })
  })

  describe('sizing mode', () => {
    it('keeps the recipe when switching between flour and pieces', () => {
      const store = useDoughStore()
      store.pieceCount = 2
      store.setSizingMode('pieces')
      // 1772 g Teig enthalten 3 % Verlust; je Teigling bleibt der Rest
      expect(store.pieceWeight).toBeCloseTo(1772 / (2 * 1.03), 9)
      expect(store.result.totalFlour).toBeCloseTo(1000, 6)
      store.pieceWeight = 900
      store.setSizingMode('flour')
      expect(store.totalFlour).toBeCloseTo((1800 * 1.03) / 1.772, 6)
    })
  })

  describe('starter', () => {
    it('applies presets and recognises the ratio', () => {
      const store = useDoughStore()
      store.applyStarterPreset('liquid')
      expect(store.starter).toMatchObject({ flour: 5, water: 5, preset: 'liquid' })
      store.setStarterParts('water', 4)
      expect(store.starter.preset).toBe('custom')
      store.setStarterParts('water', 3)
      expect(store.starter.preset).toBe('stiff')
      store.applyStarterPreset('custom')
      expect(store.starter).toMatchObject({ flour: 5, water: 3, preset: 'custom' })
    })
  })

  describe('Vorteige', () => {
    it('resets the values on type change and keeps the id', () => {
      const store = useDoughStore()
      store.addVorteig('poolish')
      const id = store.vorteige[0]!.id
      store.vorteige[0]!.flourPercent = 40
      store.setVorteigType(id, 'biga')
      expect(store.vorteige[0]).toMatchObject({
        id,
        type: 'biga',
        flourPercent: 30,
        yeastPercent: 1,
      })
      store.removeVorteig(id)
      expect(store.vorteige).toEqual([])
    })
  })

  describe('soakers', () => {
    it('scales the water with the weight for every kind', () => {
      const store = useDoughStore()
      store.addSoaker('flour')
      const id = store.soakers[0]!.id
      store.setSoakerDryGrams(id, 40)
      expect(soakerResult(store, id).water).toBeCloseTo(200, 9)
      store.setSoakerDryGrams(id, 100)
      expect(soakerResult(store, id).water).toBeCloseTo(500, 9)
    })

    it('keeps a custom water ratio when the weight changes', () => {
      const store = useDoughStore()
      store.addSoaker('sunflower')
      const id = store.soakers[0]!.id
      store.setSoakerDryGrams(id, 40)
      store.setSoakerWaterGrams(id, 40)
      store.setSoakerDryGrams(id, 60)
      expect(soakerResult(store, id).dry).toBeCloseTo(60, 9)
      expect(soakerResult(store, id).water).toBeCloseTo(60, 9)
    })

    it('resets the ratio on kind change and keeps the grams', () => {
      const store = useDoughStore()
      store.addSoaker('sunflower')
      const id = store.soakers[0]!.id
      store.setSoakerDryGrams(id, 80)
      store.setSoakerKind(id, 'flour')
      expect(soakerResult(store, id).dry).toBeCloseTo(80, 9)
      expect(soakerResult(store, id).water).toBeCloseTo(400, 9)
    })

    it('round-trips grams in pieces mode', () => {
      const store = useDoughStore()
      store.sizingMode = 'pieces'
      store.addSoaker('sunflower')
      store.addSoaker('flour')
      const [seeds, flour] = store.soakers.map((s) => s.id) as [string, string]
      store.setSoakerDryGrams(seeds, 100)
      store.setSoakerDryGrams(flour, 50)
      expect(soakerResult(store, seeds).dry).toBeCloseTo(100, 6)
      expect(soakerResult(store, flour).dry).toBeCloseTo(50, 6)

      // Mehr Saatenwasser bei festem Teiggewicht: weniger Mehl, die anderen Zutaten
      // schrumpfen anteilig mit; nur die bearbeitete Einlage behält ihre Gramm.
      const flourPercent = store.soakers[1]!.dryPercent
      store.setSoakerWaterGrams(seeds, 70)
      expect(soakerResult(store, seeds).dry).toBeCloseTo(100, 6)
      expect(soakerResult(store, seeds).water).toBeCloseTo(70, 6)
      expect(store.soakers[1]!.dryPercent).toBe(flourPercent)
      expect(soakerResult(store, flour).dry).toBeLessThan(50)
      expect(store.result.doughWeight).toBeCloseTo(1800 * 1.03, 6)
    })

    it('ignores water for an empty soaker and unreachable amounts', () => {
      const store = useDoughStore()
      store.addSoaker('sunflower')
      const id = store.soakers[0]!.id
      store.setSoakerDryGrams(id, 0)
      const before = { ...store.soakers[0]! }
      store.setSoakerWaterGrams(id, 50)
      store.setSoakerDryGrams(id, 1e9)
      expect(store.soakers[0]).toEqual(before)
    })
  })

  describe('bake time', () => {
    it('accepts only valid times', () => {
      const store = useDoughStore()
      store.setBakeTime('')
      expect(store.bakeTime).toBe('18:00')
      store.setBakeTime('7:05')
      expect(store.bakeTime).toBe('07:05')
    })
  })
})
