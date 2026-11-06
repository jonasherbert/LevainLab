import { defineComponent, type PropType } from 'vue'
import type { CalculatorTab } from '@/types/ui'
import AdvancedCard from './input/AdvancedCard.vue'
import FermentationCard from './input/FermentationCard.vue'
import RecipeBaseCard from './input/RecipeBaseCard.vue'
import SoakerCard from './input/SoakerCard.vue'
import StarterCard from './input/StarterCard.vue'
import VorteigCard from './input/VorteigCard.vue'
import RecipeSteps from './output/RecipeSteps.vue'
import RecipeSummary from './output/RecipeSummary.vue'
import WarningList from './output/WarningList.vue'

export default defineComponent({
  name: 'DoughCalculator',
  components: {
    RecipeBaseCard,
    StarterCard,
    FermentationCard,
    VorteigCard,
    SoakerCard,
    AdvancedCard,
    WarningList,
    RecipeSummary,
    RecipeSteps,
  },

  props: {
    tab: { type: String as PropType<CalculatorTab>, default: 'inputs' },
  },

  emits: {
    'update:tab': (tab: CalculatorTab) => tab === 'inputs' || tab === 'recipe',
  },
})
