import { computed, defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { fmt } from '@/utils/format'

export default defineComponent({
  name: 'RecipeBaseCard',
  components: { NumberField },

  setup() {
    const dough = useDough()

    const piecesText = computed(() => {
      const r = dough.result.value
      const loss = dough.store.lossPercent
      const allowance = loss > 0 ? ` (inkl. ${fmt.compact(loss, '%')} für Verluste)` : ''
      return `Ergibt ${fmt.grams(r.doughWeight)} Teig${allowance} mit ${fmt.grams(r.totalFlour)} Mehl.`
    })

    return { ...dough, piecesText }
  },
})
