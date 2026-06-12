import { computed, defineComponent } from 'vue'
import { useBreadStore } from '@/stores/breadStore'
import { soakerDefinitions, vorteigDefinitions } from '@/types/bread'
import { calcFermentationLeavening } from '@/utils/bread-calculator'
import VorteigList from './VorteigList.vue'
import SoakerList from './SoakerList.vue'

export default defineComponent({
  components: { VorteigList, SoakerList },

  setup() {
    const store = useBreadStore()
    const result = computed(() => store.result)

    const leaveningItems = [
      { title: 'Nur Sauerteig', value: 1.0 },
      { title: 'Sauerteig + Hefe', value: 0.8 },
      { title: 'Nur Hefe', value: 0.0 },
    ]

    const fermentationLeavening = computed(() => {
      const raw = calcFermentationLeavening(store.fermentation, store.maltPercent)
      const totalVorteigYeast = store.vorteige.reduce((sum: number, v) => sum + v.yeastPercent, 0)
      return {
        starterPercent: raw.starterPercent,
        yeastPercent: Math.max(0, raw.yeastPercent - totalVorteigYeast),
      }
    })

    return {
      store,
      result,
      soakerDefinitions,
      vorteigDefinitions,
      leaveningItems,
      fermentationLeavening,
    }
  },
})
