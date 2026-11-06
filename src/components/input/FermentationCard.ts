import { computed, defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import { fmt } from '@/utils/format'

/** Anteil der Hefe am Trieb, wenn „Hefe zugeben“ eingeschaltet wird. */
const DEFAULT_YEAST_SHARE = 20

export default defineComponent({
  name: 'FermentationCard',
  components: { NumberField },

  setup() {
    const dough = useDough()
    const { store, result } = dough

    const isTimeMode = computed(() => store.fermentation.mode === 'time')

    // Aus = reiner Sauerteig. Der Schalter folgt dem gespeicherten Anteil, damit ein
    // Moduswechsel mit Hefe ihn automatisch einschaltet.
    const yeastAssist = computed({
      get: () => store.fermentation.sourdoughShare < 100,
      set: (enabled: boolean) => {
        store.fermentation.sourdoughShare = enabled ? 100 - DEFAULT_YEAST_SHARE : 100
      },
    })

    const yeastShare = computed({
      get: () => 100 - store.fermentation.sourdoughShare,
      set: (value: number) => {
        store.fermentation.sourdoughShare = 100 - value
      },
    })

    const shareText = computed(() => {
      const yeast = 100 - store.fermentation.sourdoughShare
      return yeast >= 100
        ? 'Trieb nur aus Hefe, ohne Sauerteig'
        : `Trieb: ${fmt.num(100 - yeast)} % aus Sauerteig, ${fmt.num(yeast)} % aus Hefe`
    })

    const computedAmounts = computed(() => {
      const lv = result.value.leavening
      const parts: string[] = []
      if (lv.sourdoughPercent > 0 || lv.yeastPercent === 0) {
        parts.push(`Versäuerungsgrad ${fmt.percent(lv.sourdoughPercent)}`)
      }
      if (lv.yeastPercent > 0) parts.push(`Frischhefe ${fmt.percent(lv.yeastPercent, 3)}`)
      return parts.join(' · ')
    })

    // Mit Kühlschrankgare läuft bei Raumtemperatur nur die Stockgare; die Stückgare folgt
    // nach dem Formen im Kühlschrank.
    const hasFridge = computed(() => store.fermentation.fridgeHours > 0)
    const roomLabel = computed(() => (hasFridge.value ? 'Stockgare' : 'Raumgare'))
    const roomHint = computed(() =>
      hasFridge.value
        ? 'bei Gärtemperatur, die Stückgare läuft im Kühlschrank'
        : 'Stock- und Stückgare bei Gärtemperatur',
    )

    const estimatedTime = computed(() => {
      const lv = result.value.leavening
      if (lv.roomHours === null) return 'Ohne Triebmittel lässt sich keine Gärzeit schätzen.'
      const fridgeHours = store.fermentation.fridgeHours
      const fridgeText = fmt.hours(fridgeHours, Number.isInteger(fridgeHours) ? 0 : 1)
      return hasFridge.value
        ? `Stockgare ca. ${fmt.hours(lv.roomHours)}, dann formen und ` +
            `${fridgeText} in den Kühlschrank.`
        : `Raumgare ca. ${fmt.hours(lv.roomHours)} (Stock- und Stückgare).`
    })

    return {
      ...dough,
      isTimeMode,
      roomLabel,
      roomHint,
      yeastAssist,
      yeastShare,
      shareText,
      computedAmounts,
      estimatedTime,
    }
  },
})
