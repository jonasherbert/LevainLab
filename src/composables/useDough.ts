import { computed } from 'vue'
import { useDoughStore } from '@/stores/doughStore'
import { fmt } from '@/utils/format'
import { FIELDS } from '@/utils/schema'

/** Gemeinsame Bausteine der Karten: Store, Ergebnis, Feldgrenzen und Formatter. */
export const useDough = () => {
  const store = useDoughStore()
  const result = computed(() => store.result)
  return { store, result, fields: FIELDS, fmt }
}
