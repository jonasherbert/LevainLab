import { computed, defineComponent } from 'vue'
import { useBreadStore } from '@/stores/breadStore'
import type { SoakerKind } from '@/types/bread'

const soakerKinds: SoakerKind[] = ['Cooked', 'Scalded', 'Soaked']

export default defineComponent({
  setup() {
    const store = useBreadStore()

    const result = computed(() => store.result)

    const addSoaker = () => {
      store.addSoaker()
    }

    return {
      store,
      result,
      addSoaker,
      soakerKinds,
    }
  },
})
