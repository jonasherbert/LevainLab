import { computed, defineComponent } from 'vue'
import { useBreadStore } from '@/stores/breadStore'
import { vorteigDefinitions } from '@/types/bread'

export default defineComponent({
  setup() {
    const store = useBreadStore()
    const result = computed(() => store.result)

    const vorteigTypeItems = Array.from(vorteigDefinitions.entries()).map(([value, def]) => ({
      title: def.label,
      value,
    }))

    return { store, result, vorteigTypeItems }
  },
})
