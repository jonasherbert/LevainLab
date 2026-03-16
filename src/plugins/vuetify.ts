import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

const breadTheme = {
  dark: false,
  colors: {
    primary: '#8B5E3C',
    secondary: '#D9B382',
    accent: '#E7C873',
    background: '#F7F3EE',
    surface: '#EFE6DC',
    'on-primary': '#FFFFFF',
    'on-background': '#3A2C23',
  },
}

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'breadTheme',
    themes: {
      breadTheme,
    },
  },
})
