import { computed, defineComponent, ref } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { fmt } from '@/utils/format'

const maltItems = [
  { title: 'aktiv', value: 'active' },
  { title: 'inaktiv', value: 'inactive' },
]

/** Selten gebrauchte Einstellungen; die Standardwerte passen meist. */
export default defineComponent({
  name: 'AdvancedCard',
  components: { NumberField },

  setup() {
    const dough = useDough()
    const confirmReset = ref(false)

    const waterText = computed(() => {
      const { waterTemp, targetTemp } = dough.result.value.waterTemperature
      return waterTemp === null
        ? 'Im Hauptteig ist kein Schüttwasser, die Temperatur lässt sich nicht steuern.'
        : `Schüttwasser ca. ${fmt.temp(waterTemp)} für ${fmt.temp(targetTemp)} Teigtemperatur.`
    })

    const resetAll = () => {
      dough.store.$reset()
      confirmReset.value = false
    }

    return { ...dough, maltItems, confirmReset, waterText, resetAll }
  },
})
