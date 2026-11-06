import { computed, defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { VORTEIG_TYPES, vorteigDefinitions } from '@/types/dough'
import { fmt } from '@/utils/format'
import { vorteigLabels } from '@/utils/labels'

const typeItems = VORTEIG_TYPES.map((type) => ({
  title: vorteigDefinitions[type].label,
  value: type,
}))

export default defineComponent({
  name: 'VorteigCard',
  components: { NumberField },

  setup() {
    const dough = useDough()
    const { store, result } = dough

    const isTimeMode = computed(() => store.fermentation.mode === 'time')
    const labels = computed(() => vorteigLabels(store.vorteige))

    const captions = computed(() => {
      const map = new Map<string, string>()
      for (const v of result.value.vorteige) {
        if (isTimeMode.value) {
          map.set(
            v.id,
            v.hours === null
              ? 'Ohne Gärzeit lässt sich keine Hefemenge berechnen.'
              : `Frischhefe ${fmt.percent(v.yeastPercent, 3)} vom Vorteigmehl (${fmt.grams(v.yeast, 2)}).`,
          )
        } else {
          map.set(
            v.id,
            v.hours === null
              ? 'Ohne Hefe gärt der Vorteig nicht.'
              : `Reif nach ca. ${fmt.hours(v.hours)} (${fmt.grams(v.yeast, 2)} Frischhefe).`,
          )
        }
      }
      return map
    })

    return { ...dough, typeItems, isTimeMode, labels, captions }
  },
})
