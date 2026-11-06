import { computed, defineComponent, nextTick, ref, watch } from 'vue'
import { formatInputNumber, formatNumber, parseDecimal } from '@/utils/format'
import { clamp, roundTo } from '@/utils/numbers'

/**
 * Zahlenfeld, das nur gültige Zahlen an das Model weitergibt.
 * - Komma und Punkt sind beide erlaubt.
 * - Leere oder ungültige Eingaben ändern das Model nicht; beim Verlassen erscheint wieder der
 *   gespeicherte Wert.
 * - Werte außerhalb von min/max werden beim Verlassen begrenzt, aber nur nach einer Bearbeitung.
 */
export default defineComponent({
  name: 'NumberField',

  props: {
    modelValue: { type: Number, required: true },
    label: { type: String, default: undefined },
    suffix: { type: String, default: undefined },
    min: { type: Number, default: 0 },
    max: { type: Number, default: Number.POSITIVE_INFINITY },
    decimals: { type: Number, default: 0 },
    hint: { type: String, default: undefined },
    readonly: { type: Boolean, default: false },
  },

  emits: {
    'update:modelValue': (value: number) => Number.isFinite(value),
  },

  setup(props, { emit }) {
    const focused = ref(false)
    const dirty = ref(false)
    const draft = ref(formatInputNumber(props.modelValue, props.decimals))

    watch(
      () => [props.modelValue, props.decimals] as const,
      ([value, decimals]) => {
        if (!focused.value) draft.value = formatInputNumber(value, decimals)
      },
    )

    const parsed = computed(() => parseDecimal(draft.value, { integer: props.decimals === 0 }))

    const errorMessages = computed((): string[] => {
      if (!focused.value || !dirty.value || draft.value.trim() === '') return []
      const value = parsed.value
      if (value === null) return ['Keine gültige Zahl']
      if (value < props.min || value > props.max) {
        return [
          `Erlaubt: ${formatNumber(props.min, props.decimals)} bis ${formatNumber(props.max, props.decimals)}`,
        ]
      }
      return []
    })

    const commit = (value: number) => {
      const next = roundTo(clamp(value, props.min, props.max), props.decimals)
      if (next !== props.modelValue) emit('update:modelValue', next)
    }

    // Der Store kann den Wert umrechnen oder ignorieren; danach den gespeicherten Wert zeigen.
    const showStoredValue = async () => {
      await nextTick()
      if (!focused.value) draft.value = formatInputNumber(props.modelValue, props.decimals)
    }

    const finishEditing = () => {
      if (dirty.value && parsed.value !== null) commit(parsed.value)
      dirty.value = false
      return showStoredValue()
    }

    const onInput = (text: string | null) => {
      dirty.value = true
      draft.value = text ?? ''
      // Eingaben ohne Fokus (z. B. Autofill) sofort abschließen statt leer stehen zu lassen.
      if (!focused.value) {
        void finishEditing()
        return
      }
      const value = parsed.value
      if (value !== null && value >= props.min && value <= props.max) commit(value)
    }

    const onFocusChange = async (isFocused: boolean) => {
      focused.value = isFocused
      if (isFocused) {
        dirty.value = false
        return
      }
      await finishEditing()
    }

    const inputmode = computed(() => (props.decimals > 0 ? 'decimal' : 'numeric'))

    return { draft, errorMessages, inputmode, onInput, onFocusChange }
  },
})
