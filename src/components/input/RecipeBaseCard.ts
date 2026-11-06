import { defineComponent } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'

export default defineComponent({
  name: 'RecipeBaseCard',
  components: { NumberField },

  setup() {
    return { ...useDough() }
  },
})
