import { computed, defineComponent, onErrorCaptured, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import DoughCalculator from '@/components/DoughCalculator.vue'
import { useDoughStore } from '@/stores/doughStore'
import type { CalculatorTab } from '@/types/ui'

const THEME_KEY = 'levainlab_theme'
const TAB_KEY = 'levainlab_tab'

const readTab = (): CalculatorTab => {
  try {
    return localStorage.getItem(TAB_KEY) === 'recipe' ? 'recipe' : 'inputs'
  } catch {
    return 'inputs'
  }
}

export default defineComponent({
  components: { DoughCalculator },

  setup() {
    const theme = useTheme()
    const isDark = ref(localStorage.getItem(THEME_KEY) === 'darkTheme')
    const themeName = () => (isDark.value ? 'darkTheme' : 'lightTheme')
    theme.change(themeName())

    const toggleTheme = () => {
      isDark.value = !isDark.value
      theme.change(themeName())
      localStorage.setItem(THEME_KEY, themeName())
    }

    // Eingaben oder Rezept; die Auswahl bleibt beim Neuladen erhalten.
    const tab = ref<CalculatorTab>(readTab())
    watch(tab, (value) => {
      if (value !== 'inputs' && value !== 'recipe') {
        tab.value = 'inputs'
        return
      }
      try {
        localStorage.setItem(TAB_KEY, value)
      } catch {
        // Speicher nicht verfügbar
      }
      window.scrollTo({ top: 0 })
    })

    const store = useDoughStore()
    const warningCount = computed(() => store.result.warnings.length)

    // Statt einer leeren Seite: Hinweis mit der Möglichkeit, die Eingaben zurückzusetzen.
    const renderError = ref(false)
    const calculatorKey = ref(0)
    onErrorCaptured((error) => {
      console.error(error)
      renderError.value = true
      return false
    })
    const resetInputs = () => {
      store.$reset()
      renderError.value = false
      calculatorKey.value++
    }

    return { isDark, toggleTheme, tab, warningCount, renderError, calculatorKey, resetInputs }
  },
})
