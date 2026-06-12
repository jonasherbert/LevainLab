import { defineComponent } from 'vue'
import { useBreadStore } from '@/stores/breadStore'
import { soakerDefinitions } from '@/types/bread'

export default defineComponent({
  setup() {
    const store = useBreadStore()

    const soakerKindItems = Array.from(soakerDefinitions.entries())
      .filter(([kind]) => kind !== 'grain')
      .map(([value, def]) => ({ title: def.label, value }))

    return { store, soakerKindItems }
  },
})
