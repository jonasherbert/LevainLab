import { defineComponent, ref } from 'vue'
import { useTheme } from 'vuetify'
import DoughCalculator from '@/components/DoughCalculator.vue'

const THEME_KEY = 'levainlab_theme'

export default defineComponent({
  components: { DoughCalculator },

  setup() {
    const theme = useTheme()
    const isDark = ref(localStorage.getItem(THEME_KEY) === 'darkTheme')

    theme.global.name.value = isDark.value ? 'darkTheme' : 'lightTheme'

    const toggleTheme = () => {
      isDark.value = !isDark.value
      theme.global.name.value = isDark.value ? 'darkTheme' : 'lightTheme'
      localStorage.setItem(THEME_KEY, theme.global.name.value)
    }

    return { isDark, toggleTheme }
  },
})
