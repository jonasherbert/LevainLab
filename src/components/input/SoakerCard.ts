import { computed, defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { SOAKER_KINDS, soakerDefinitions, type SoakerCategory } from '@/types/dough'
import { formatInputNumber } from '@/utils/format'
import { soakerLabels } from '@/utils/labels'

const kindItems = SOAKER_KINDS.map((kind) => ({
  title: soakerDefinitions[kind].label,
  value: kind,
}))

const categoryHints: Record<SoakerCategory, string> = {
  grain: 'zählt als Mehl, das Wasser zählt zur Hydration',
  seed: 'Wasser zählt nicht zur Hydration – nur so viel Wasser, wie die Saat aufnimmt',
}

export default defineComponent({
  name: 'SoakerCard',
  components: { NumberField },

  setup() {
    const dough = useDough()
    const labels = computed(() => soakerLabels(dough.store.soakers))
    const ratio = (value: number) => formatInputNumber(value, 2)
    return { ...dough, kindItems, categoryHints, labels, ratio }
  },
})
