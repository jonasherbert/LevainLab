import { defineStore } from 'pinia'
import { calculateDough } from '@/utils/bread-calculator'
import type { DoughState, SoakerKind } from '@/types/bread'

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

    soakers: [],
  }),

  getters: {
    result: (state) => calculateDough(state),
  },

  actions: {
    addSoaker(kind: SoakerKind = 'Soaked', flour: number = 50, water: number = 150) {
      this.soakers.push({
        id: crypto.randomUUID(),
        kind,
        flour,
        water,
      })
    },

    removeSoaker(id: string) {
      this.soakers = this.soakers.filter((s) => s.id !== id)
    },
  },

  persist: true,
})
