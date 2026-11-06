import { computed, defineComponent, ref, watch } from 'vue'
import NumberField from '@/components/form/NumberField.vue'
import { useDough } from '@/composables/useDough'
import type { ScheduleStep, ScheduleStepKind } from '@/types/dough-result'
import { fmt } from '@/utils/format'
import { scheduleStepLabel, soakerLabels, vorteigLabels } from '@/utils/labels'

const STEP_ICONS: Record<ScheduleStepKind, string> = {
  soakers: 'mdi-seed-outline',
  starter: 'mdi-flask-outline',
  vorteig: 'mdi-bowl-mix-outline',
  mix: 'mdi-hand-back-right-outline',
  shape: 'mdi-baguette',
  fridge: 'mdi-fridge-outline',
  bake: 'mdi-fire',
}

type PlanStep = Pick<ScheduleStep, 'kind' | 'refId'> &
  Partial<Pick<ScheduleStep, 'dayOffset' | 'time'>>

interface StepItem {
  label: string
  amount: string
}

interface StepView {
  key: string
  when: string
  title: string
  icon: string
  items: StepItem[]
  note: string | null
  isBake: boolean
}

/** Das Rezept als Ablauf: jeder Schritt mit Uhrzeit und den Mengen, die er braucht. */
export default defineComponent({
  name: 'RecipeSteps',
  components: { NumberField },

  setup() {
    const { store, result, fields } = useDough()

    // Eigener Entwurf, damit ein geleertes Zeitfeld nicht leer stehen bleibt.
    const bakeTimeDraft = ref(store.bakeTime)
    watch(
      () => store.bakeTime,
      (value) => {
        bakeTimeDraft.value = value
      },
    )
    const onBakeTimeInput = (value: string | null) => {
      bakeTimeDraft.value = value ?? ''
      store.setBakeTime(bakeTimeDraft.value)
    }
    const onBakeTimeFocus = (focused: boolean) => {
      if (!focused) bakeTimeDraft.value = store.bakeTime
    }

    // Mit Kühlschrankgare wird vor dem Kühlschrank geformt; die Stückgare spielt dann keine Rolle.
    const showProof = computed(() => store.fermentation.fridgeHours === 0)

    const steps = computed((): StepView[] => {
      const r = result.value
      const f = store.fermentation
      const vorteigNames = vorteigLabels(r.vorteige)
      const soakerNames = soakerLabels(r.soakers)
      const vorteigLabel = (id: string) => vorteigNames.get(id) ?? 'Vorteig'
      const soakerLabel = (id: string) => soakerNames.get(id) ?? 'Einlage'
      const roomHours = r.leavening.roomHours
      const proofHours = roomHours === null ? null : Math.min(f.proofHours, roomHours)

      // Ohne Triebmittel gibt es keinen Zeitplan; die Schritte erscheinen dann ohne Uhrzeit.
      const plan: PlanStep[] = r.schedule?.steps ?? [
        ...(r.soakers.length ? [{ kind: 'soakers' as const, refId: null }] : []),
        ...(r.starter ? [{ kind: 'starter' as const, refId: null }] : []),
        ...r.vorteige.map((v) => ({ kind: 'vorteig' as const, refId: v.id })),
        { kind: 'mix', refId: null },
        { kind: 'bake', refId: null },
      ]

      const details = (step: PlanStep): Pick<StepView, 'items' | 'note'> => {
        switch (step.kind) {
          case 'soakers':
            return {
              items: r.soakers.flatMap((s) => [
                { label: soakerLabel(s.id), amount: fmt.grams(s.dry) },
                { label: 'Wasser', amount: fmt.grams(s.water) },
              ]),
              note: null,
            }
          case 'starter': {
            const s = r.starter
            if (!s) return { items: [], note: null }
            const reserve = s.reserve > 0 ? `, ${fmt.grams(s.reserve)} bleiben als Anstellgut` : ''
            return {
              items: [
                { label: 'Anstellgut', amount: fmt.grams(s.seed) },
                { label: 'Mehl', amount: fmt.grams(s.feedFlour) },
                { label: 'Wasser', amount: fmt.grams(s.feedWater) },
              ],
              note:
                `Reif nach ca. ${fmt.hours(r.starterProfile.ripeningHours)} bei ` +
                `${fmt.temp(r.starterProfile.temp)}. ${fmt.grams(s.forRecipe)} kommen in den Teig${reserve}.`,
            }
          }
          case 'vorteig': {
            const v = r.vorteige.find((item) => item.id === step.refId)
            if (!v) return { items: [], note: null }
            return {
              items: [
                { label: 'Mehl', amount: fmt.grams(v.flour) },
                { label: 'Wasser', amount: fmt.grams(v.water) },
                { label: 'Frischhefe', amount: fmt.grams(v.yeast, 2) },
              ],
              note:
                v.hours === null
                  ? 'Ohne Hefe bzw. Gärzeit gärt der Vorteig nicht.'
                  : `Reif nach ca. ${fmt.hours(v.hours)} bei ${fmt.temp(v.temp)}.`,
            }
          }
          case 'mix': {
            const m = r.main
            const waterTemp = r.waterTemperature.waterTemp
            const items: StepItem[] = [
              {
                label: 'Wasser',
                amount:
                  waterTemp === null
                    ? fmt.grams(m.water)
                    : `${fmt.grams(m.water)} · ${fmt.temp(waterTemp)}`,
              },
              ...(r.starter
                ? [{ label: 'Sauerteig', amount: fmt.grams(r.starter.forRecipe) }]
                : []),
              ...r.vorteige.map((v) => ({ label: vorteigLabel(v.id), amount: fmt.grams(v.total) })),
              { label: 'Mehl', amount: fmt.grams(m.flour) },
              ...r.soakers.map((s) => ({ label: soakerLabel(s.id), amount: fmt.grams(s.total) })),
              ...(fmt.has(m.salt, 1) ? [{ label: 'Salz', amount: fmt.grams(m.salt, 1) }] : []),
              ...(fmt.has(m.yeast, 1)
                ? [{ label: 'Frischhefe', amount: fmt.grams(m.yeast, 1) }]
                : []),
              ...(fmt.has(m.malt, 1) ? [{ label: 'Malz', amount: fmt.grams(m.malt, 1) }] : []),
            ]
            const stockHours =
              roomHours === null
                ? null
                : f.fridgeHours > 0
                  ? roomHours
                  : roomHours - (proofHours ?? 0)
            return {
              items,
              note:
                stockHours === null
                  ? null
                  : `Danach Stockgare ca. ${fmt.compact(stockHours, 'h')} bei ${fmt.temp(f.roomTemp)}.`,
            }
          }
          case 'shape':
            return {
              items: [],
              note:
                proofHours === null
                  ? null
                  : `Stückgare ca. ${fmt.compact(proofHours, 'h')} bei ${fmt.temp(f.roomTemp)}.`,
            }
          case 'fridge':
            return {
              items: [],
              note:
                `Stückgare ${fmt.compact(f.fridgeHours, 'h')} bei ${fmt.temp(f.fridgeTemp)}, ` +
                'danach direkt backen.',
            }
          case 'bake':
            return { items: [], note: null }
        }
      }

      return plan.map((step, index) => ({
        key: `${step.kind}-${step.refId ?? index}`,
        when:
          step.dayOffset !== undefined && step.time !== undefined
            ? `${fmt.day(step.dayOffset)} · ${step.time}`
            : 'ohne Zeitangabe',
        title: scheduleStepLabel(step, vorteigLabel),
        icon: STEP_ICONS[step.kind],
        ...details(step),
        isBake: step.kind === 'bake',
      }))
    })

    return {
      store,
      fields,
      bakeTimeDraft,
      onBakeTimeInput,
      onBakeTimeFocus,
      showProof,
      steps,
    }
  },
})
