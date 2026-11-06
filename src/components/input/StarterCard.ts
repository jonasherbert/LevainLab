import { computed, defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { starterPresets } from '@/types/dough'
import { fmt, formatInputNumber } from '@/utils/format'

/** Teile ohne überflüssige Nachkommastellen: 5 statt 5,0. */
const parts = (value: number) => formatInputNumber(value, 1)

const presetItems = [
  ...starterPresets.map((p) => ({
    title: `${p.label} · 1 : ${parts(p.flour)} : ${parts(p.water)}`,
    value: p.id,
  })),
  { title: 'Benutzerdefiniert', value: 'custom' },
]

export default defineComponent({
  name: 'StarterCard',
  components: { NumberField },

  setup() {
    const dough = useDough()

    const profileHint = computed(() => {
      const profile = dough.result.value.starterProfile
      return (
        `TA ${fmt.num(profile.ta)} · reif nach ca. ${fmt.hours(profile.ripeningHours)} ` +
        `bei ${fmt.temp(profile.temp)}`
      )
    })

    return { ...dough, presetItems, profileHint }
  },
})
