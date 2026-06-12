import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

const lightTheme = {
  dark: false,
  colors: {
    primary:         '#3D2B1F',
    secondary:       '#9A7B5A',
    accent:          '#C8A24A',
    background:      '#F9F7F4',
    surface:         '#F0EBE3',
    appbar:          '#3D2B1F',
    'on-appbar':     '#FFFFFF',
    'on-primary':    '#FFFFFF',
    'on-background': '#1A1109',
    'on-surface':    '#1A1109',
  },
}

const darkTheme = {
  dark: true,
  colors: {
    primary:         '#C8956A',
    secondary:       '#8B6240',
    accent:          '#D4A830',
    background:      '#18110A',
    surface:         '#271A0F',
    appbar:          '#1F1409',
    'on-appbar':     '#F2E4CC',
    'on-primary':    '#18110A',
    'on-background': '#F2E4CC',
    'on-surface':    '#F2E4CC',
  },
}

export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'lightTheme',
    themes: { lightTheme, darkTheme },
  },
})
