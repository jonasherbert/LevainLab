import { computed, defineComponent } from 'vue'
import { useDough } from '@/composables/useDough'
import { fmt } from '@/utils/format'

/** Drei Kennzahlen über dem Ablauf: Teig, Hydration, Gare. */
export default defineComponent({
  name: 'RecipeSummary',

  setup() {
    const { store, result } = useDough()

    const tiles = computed(() => {
      const r = result.value
      const { summary, leavening } = r
      const fridgeHours = store.fermentation.fridgeHours
      const withSeeds = summary.hydrationInclSeedWater > summary.hydration + 0.05
      const allowance = summary.lossPercent ? ` + ${fmt.compact(summary.lossPercent, '%')}` : ''
      const pieces =
        summary.pieceCount !== null && summary.pieceWeight !== null
          ? `${summary.pieceCount} × ${fmt.grams(summary.pieceWeight)}${allowance}`
          : null
      return [
        {
          key: 'dough',
          label: 'Teig',
          value: fmt.grams(summary.doughWeight),
          detail: pieces ?? `${fmt.grams(r.totalFlour)} Mehl`,
        },
        {
          key: 'hydration',
          label: 'Hydration',
          value: fmt.compact(summary.hydration, '%'),
          detail: withSeeds
            ? `inkl. Saaten ${fmt.compact(summary.hydrationInclSeedWater, '%')}`
            : `TA ${fmt.num(summary.ta)}`,
        },
        {
          key: 'time',
          label: fridgeHours > 0 ? 'Stockgare' : 'Raumgare',
          value: fmt.compact(leavening.roomHours, 'h'),
          detail:
            fridgeHours > 0
              ? `+ ${fmt.compact(fridgeHours, 'h')} Kühlschrank`
              : `bei ${fmt.temp(store.fermentation.roomTemp)}`,
        },
      ]
    })

    return { tiles }
  },
})
