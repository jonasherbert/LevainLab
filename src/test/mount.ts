import { defineComponent, h, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { VApp } from 'vuetify/components'
import { createAppVuetify } from '@/plugins/vuetify'

/**
 * Mountet eine Komponente wie in der App (Pinia mit Persistenz, Vuetify, VApp).
 * Render-Fehler und Vue-Warnungen werden gesammelt: Die Templates liegen in .html-Dateien und
 * werden weder von vue-tsc noch von ESLint geprüft – die Warnungen sind der Ersatz dafür.
 */
export const mountWithApp = (component: Component) => {
  const errors: unknown[] = []
  const warnings: string[] = []
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  const Root = defineComponent({
    render: () => h(VApp, null, { default: () => h(component) }),
  })
  const wrapper = mount(Root, {
    global: {
      plugins: [pinia, createAppVuetify()],
      config: {
        errorHandler: (error) => {
          errors.push(error)
        },
        warnHandler: (message) => {
          warnings.push(message)
        },
      },
    },
  })
  return { wrapper, errors, warnings, pinia }
}
