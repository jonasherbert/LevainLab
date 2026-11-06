import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createAppVuetify } from '@/plugins/vuetify'
import NumberField from './NumberField.vue'

interface FieldProps {
  modelValue: number
  min?: number
  max?: number
  decimals?: number
}

const mountField = (props: FieldProps) => {
  const wrapper = mount(NumberField, { props, global: { plugins: [createAppVuetify()] } })
  const input = wrapper.find('input')
  const emitted = () => (wrapper.emitted('update:modelValue') ?? []).map(([value]) => value)
  const type = async (text: string) => {
    await input.trigger('focus')
    await input.setValue(text)
  }
  const blur = async () => {
    await input.trigger('blur')
    await flushPromises()
  }
  return { wrapper, input, emitted, type, blur }
}

describe('NumberField', () => {
  it('accepts a comma as decimal separator', async () => {
    const field = mountField({ modelValue: 2.2, decimals: 2, max: 5 })
    expect(field.input.element.value).toBe('2,2')
    await field.type('2,5')
    expect(field.emitted()).toEqual([2.5])
  })

  it('emits nothing when cleared and shows the stored value again', async () => {
    const field = mountField({ modelValue: 25 })
    await field.type('')
    expect(field.emitted()).toEqual([])
    await field.blur()
    expect(field.emitted()).toEqual([])
    expect(field.input.element.value).toBe('25')
  })

  it('emits nothing for invalid text and shows an error', async () => {
    const field = mountField({ modelValue: 25 })
    await field.type('abc')
    expect(field.emitted()).toEqual([])
    expect(field.wrapper.text()).toContain('Keine gültige Zahl')
  })

  it('clamps out-of-range values on blur only', async () => {
    const field = mountField({ modelValue: 2, decimals: 1, min: 0, max: 5 })
    await field.type('9')
    expect(field.emitted()).toEqual([])
    expect(field.wrapper.text()).toContain('Erlaubt')
    await field.blur()
    expect(field.emitted()).toEqual([5])
  })

  it('rounds to the allowed decimals', async () => {
    const field = mountField({ modelValue: 2, decimals: 1, max: 5 })
    await field.type('2,25')
    expect(field.emitted()).toEqual([2.3])
  })

  it('does not commit when focused and left without editing', async () => {
    const field = mountField({ modelValue: 2.256, decimals: 1, max: 5 })
    await field.input.trigger('focus')
    await field.blur()
    expect(field.emitted()).toEqual([])
  })

  it('finishes input that arrives without focus right away', async () => {
    const field = mountField({ modelValue: 25 })
    await field.input.setValue('')
    await flushPromises()
    expect(field.input.element.value).toBe('25')
    await field.input.setValue('9999')
    await flushPromises()
    expect(field.emitted()).toEqual([9999])
  })

  it('keeps the draft while focused and follows the model afterwards', async () => {
    const field = mountField({ modelValue: 10 })
    await field.type('12')
    await field.wrapper.setProps({ modelValue: 99 })
    expect(field.input.element.value).toBe('12')
    await field.blur()
    expect(field.input.element.value).toBe('99')
  })
})
