import { computed, defineComponent } from 'vue'
import { useDough } from '@/composables/useDough'
import { vorteigLabels } from '@/utils/labels'
import { describeWarning } from '@/utils/warning-text'

export default defineComponent({
  name: 'WarningList',

  setup() {
    const { result } = useDough()

    const warnings = computed(() => {
      const labels = vorteigLabels(result.value.vorteige)
      return result.value.warnings.map((w) =>
        describeWarning(w, (id) => labels.get(id) ?? 'Vorteig'),
      )
    })

    return { warnings }
  },
})
