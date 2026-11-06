import { describe, expect, it } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { useDoughStore } from '@/stores/doughStore'
import { LEGACY_VERSION_KEY, STORAGE_KEY } from '@/stores/persistence'
import { mountWithApp } from '@/test/mount'
import { createDefaultState } from '@/utils/schema'
import DoughCalculator from './DoughCalculator.vue'
import NumberField from './form/NumberField.vue'

type Store = ReturnType<typeof useDoughStore>

const CARDS = [
  'card-base',
  'card-starter',
  'card-fermentation',
  'card-vorteige',
  'card-soakers',
  'card-advanced',
  'recipe-summary',
  'recipe-steps',
]

const scenarios: Record<string, (store: Store) => void> = {
  defaults: () => {},
  'time mode, 50 % sourdough': (store) => {
    store.setFermentationMode('time')
    store.fermentation.sourdoughShare = 50
  },
  'yeast only': (store) => {
    store.setFermentationMode('time')
    store.fermentation.sourdoughShare = 0
  },
  'sized by pieces': (store) => store.setSizingMode('pieces'),
  'Vorteige and soakers': (store) => {
    store.addVorteig('poolish')
    store.addVorteig('biga')
    store.addSoaker('flour')
    store.addSoaker('sunflower')
  },
  everything: (store) => {
    store.addVorteig('poolish')
    store.addSoaker('bread')
    store.addSoaker('flaxseed')
    store.maltPercent = 1
    store.fermentation.fridgeHours = 12
    store.setSizingMode('pieces')
    store.setFermentationMode('time')
  },
}

const setup = async (scenario: (store: Store) => void) => {
  const mounted = mountWithApp(DoughCalculator)
  const store = useDoughStore(mounted.pinia)
  scenario(store)
  await flushPromises()
  return { ...mounted, store }
}

const expandAdvanced = async (wrapper: VueWrapper) => {
  await wrapper.find('[data-testid="advanced-toggle"]').trigger('click')
  await flushPromises()
}

const editableFields = (wrapper: VueWrapper) =>
  wrapper.findAllComponents(NumberField).filter((field) => !field.props('readonly'))

const enter = async (wrapper: VueWrapper, index: number, text: string) => {
  const input = editableFields(wrapper)[index]!.find('input')
  await input.trigger('focus')
  await input.setValue(text)
  await input.trigger('blur')
  await flushPromises()
  return input
}

describe('DoughCalculator', () => {
  describe.each(Object.entries(scenarios))('%s', (_name, scenario) => {
    it('renders all cards without errors or warnings', async () => {
      const { wrapper, errors, warnings } = await setup(scenario)
      for (const card of CARDS) expect(wrapper.find(`[data-testid="${card}"]`).exists()).toBe(true)
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
    })

    it('survives clearing every number field', async () => {
      const { wrapper, errors, warnings, store } = await setup(scenario)
      const visible = editableFields(wrapper).length
      await expandAdvanced(wrapper)
      const before = JSON.stringify(store.$state)
      const count = editableFields(wrapper).length
      expect(visible).toBeGreaterThan(8)
      expect(count - visible).toBe(4)
      for (let i = 0; i < count; i++) {
        const input = await enter(wrapper, i, '')
        expect(input.element.value).not.toBe('')
      }
      expect(JSON.stringify(store.$state)).toBe(before)
      expect(wrapper.find('[data-testid="recipe-steps"]').exists()).toBe(true)
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
    })
  })

  it('clamps extreme values without crashing', async () => {
    const { wrapper, errors, warnings } = await setup(scenarios.everything!)
    await expandAdvanced(wrapper)
    for (const text of ['999999', '-999999']) {
      const count = editableFields(wrapper).length
      for (let i = 0; i < count && i < editableFields(wrapper).length; i++) {
        await enter(wrapper, i, text)
      }
    }
    expect(wrapper.find('[data-testid="recipe-steps"]').exists()).toBe(true)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('switches modes through the toggles', async () => {
    const { wrapper, store } = await setup(scenarios.defaults!)
    await wrapper.find('[data-testid="mode-time"]').trigger('click')
    expect(store.fermentation.mode).toBe('time')
    await wrapper.find('[data-testid="sizing-pieces"]').trigger('click')
    expect(store.sizingMode).toBe('pieces')
    await wrapper.find('[data-testid="add-vorteig"]').trigger('click')
    await wrapper.find('[data-testid="add-soaker"]').trigger('click')
    expect(store.vorteige).toHaveLength(1)
    expect(store.soakers).toHaveLength(1)
  })

  it('adds yeast in time mode only when switched on', async () => {
    const { wrapper, store } = await setup((s) => s.setFermentationMode('time'))
    // Vuetify übernimmt beim input-Event den checked-Zustand der Checkbox.
    const toggle = async () => {
      const input = wrapper.find('[data-testid="yeast-assist"] input')
      const checkbox = input.element as HTMLInputElement
      checkbox.checked = !checkbox.checked
      await input.trigger('input')
    }
    expect(wrapper.find('[data-testid="yeast-share"]').exists()).toBe(false)
    await toggle()
    expect(store.fermentation.sourdoughShare).toBe(80)
    expect(wrapper.find('[data-testid="yeast-share"]').text()).toContain('20 % aus Hefe')
    await toggle()
    expect(store.fermentation.sourdoughShare).toBe(100)
    expect(wrapper.find('[data-testid="yeast-share"]').exists()).toBe(false)
  })

  it('switches the yeast on when coming from amount mode with yeast', async () => {
    const { wrapper, store } = await setup((s) => {
      s.yeastPercent = 0.1
      s.setFermentationMode('time')
    })
    expect(store.fermentation.sourdoughShare).toBeLessThan(100)
    expect(wrapper.find('[data-testid="yeast-share"]').exists()).toBe(true)
  })

  it('resets all inputs only after confirmation', async () => {
    const { wrapper, store } = await setup(scenarios.everything!)
    await expandAdvanced(wrapper)
    await wrapper.find('[data-testid="reset"]').trigger('click')
    expect(store.vorteige).toHaveLength(1)
    await wrapper.find('[data-testid="reset-confirm"]').trigger('click')
    await flushPromises()
    expect(store.$state).toEqual(createDefaultState())
  })

  it('shows the recipe as steps with times and amounts', async () => {
    const { wrapper } = await setup(scenarios.defaults!)
    const steps = wrapper.find('[data-testid="recipe-steps"]').text()
    expect(steps).toContain('Vortag · 23:35')
    expect(steps).toContain('Sauerteig ansetzen')
    expect(steps).toContain('320 g kommen in den Teig')
    expect(steps).toContain('Backtag · 11:05')
    expect(steps).toContain('Hauptteig kneten')
    expect(wrapper.find('[data-testid="recipe-summary"]').text()).toContain('1.772')
  })

  it('switches to the recipe with the button at the end of the inputs', async () => {
    const { wrapper } = await setup(scenarios.defaults!)
    await wrapper.find('[data-testid="to-recipe"]').trigger('click')
    expect(wrapper.findComponent(DoughCalculator).emitted('update:tab')).toEqual([['recipe']])
  })

  it('lists the steps without times when there is no leavening', async () => {
    const { wrapper, errors } = await setup((s) => (s.starter.percent = 0))
    const steps = wrapper.find('[data-testid="recipe-steps"]').text()
    expect(steps).toContain('Hauptteig kneten')
    expect(steps).toContain('ohne Zeitangabe')
    expect(errors).toEqual([])
  })

  it('migrates a stored v1 state that used to brick the app', async () => {
    localStorage.setItem(LEGACY_VERSION_KEY, '1')
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalFlour: 1000,
        targetHydration: 80,
        saltPercent: 2.2,
        yeastPercent: 0,
        maltPercent: 0,
        starter: { percent: 20, flour: 5, water: 3, reserve: '' },
        fermentation: {
          mode: 'manual',
          roomHours: 8,
          roomTemp: 21,
          fridgeHours: 0,
          fridgeTemp: 5,
          leaveningContribution: 1,
        },
        vorteige: [],
        soakers: [{ id: 's', kind: 'sunflower', dry: 40, water: '' }],
      }),
    )
    const { wrapper, errors, store } = await setup(scenarios.defaults!)
    expect(errors).toEqual([])
    expect(store.targetHydration).toBe(80)
    expect(store.starter.reserve).toBe(25)
    expect(wrapper.find('[data-testid="recipe-steps"]').exists()).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(2)
    expect(localStorage.getItem(LEGACY_VERSION_KEY)).toBeNull()
  })
})
