import { defineStore } from 'pinia'
import { calculateDough } from '@/utils/bread-calculator'
import { soakerDefinitions, vorteigDefinitions } from '@/types/bread'
import type { DoughState, SoakerKind, VorteigType } from '@/types/bread'

const SCHEMA_VERSION = 1
const SCHEMA_VERSION_KEY = 'bread_schema_v'

export const useBreadStore = defineStore('bread', {
  state: (): DoughState => ({
    totalFlour: 1000,
    targetHydration: 80,

    saltPercent: 2.2,
    yeastPercent: 0,
    maltPercent: 0,

    starter: {
      percent: 20,
      flour: 5,
      water: 3,
      reserve: 25,
    },

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
  }),

  getters: {
    result: (state) => calculateDough(state),
  },

  actions: {
    addVorteig(type: VorteigType = 'poolish') {
      const def = vorteigDefinitions.get(type)!
      this.vorteige.push({
        id: crypto.randomUUID(),
        type,
        flourPercent: def.defaultFlourPercent,
        hydration: def.defaultHydration,
        yeastPercent: def.defaultYeastPercent,
        fermentationHours: def.defaultFermentationHours,
        fermentationTemp: def.defaultFermentationTemp,
      })
    },

    removeVorteig(id: string) {
      this.vorteige = this.vorteige.filter((v) => v.id !== id)
    },

    updateVorteigType(id: string, type: VorteigType) {
      const v = this.vorteige.find((v) => v.id === id)
      if (!v) return
      const def = vorteigDefinitions.get(type)!
      v.type = type
      v.flourPercent = def.defaultFlourPercent
      v.hydration = def.defaultHydration
      v.yeastPercent = def.defaultYeastPercent
      v.fermentationHours = def.defaultFermentationHours
      v.fermentationTemp = def.defaultFermentationTemp
    },

    addSoaker(kind: SoakerKind = 'sunflower') {
      const def = soakerDefinitions.get(kind)!
      const dry = 40
      this.soakers.push({
        id: crypto.randomUUID(),
        kind,
        dry,
        water: Math.round(dry * def.waterRatio),
      })
    },

    removeSoaker(id: string) {
      this.soakers = this.soakers.filter((s) => s.id !== id)
    },

    updateSoakerKind(id: string, kind: SoakerKind) {
      const soaker = this.soakers.find((s) => s.id === id)
      if (!soaker) return
      soaker.kind = kind
      const def = soakerDefinitions.get(kind)!
      soaker.water = Math.round(soaker.dry * def.waterRatio)
    },

    updateSoakerDry(id: string, dry: number) {
      const soaker = this.soakers.find((s) => s.id === id)
      if (!soaker) return
      soaker.dry = dry
      const def = soakerDefinitions.get(soaker.kind)!
      if (!def.isFlour) {
        soaker.water = Math.round(dry * def.waterRatio)
      }
    },
  },

  persist: {
    afterHydrate({ store }) {
      const stored = Number(localStorage.getItem(SCHEMA_VERSION_KEY) ?? 0)
      if (stored !== SCHEMA_VERSION) {
        store.$reset()
        localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION))
      }
    },
  },
})
