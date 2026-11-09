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

/** Zeile mit Grammangabe; null, wenn die Menge gerundet 0 ist (solche Zeilen entfallen). */
const gramsItem = (label: string, grams: number, decimals = 0, extra = ''): StepItem | null =>
  fmt.has(grams, decimals) ? { label, amount: `${fmt.grams(grams, decimals)}${extra}` } : null

const present = (items: (StepItem | null)[]): StepItem[] =>
  items.filter((item): item is StepItem => item !== null)

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
      const plan: PlanStep[] = r.schedule?.steps.slice() ?? [
        ...(r.soakers.some((s) => fmt.has(s.dry))
          ? [{ kind: 'soakers' as const, refId: null }]
          : []),
        ...(r.starter ? [{ kind: 'starter' as const, refId: null }] : []),
        { kind: 'mix', refId: null },
        { kind: 'bake', refId: null },
      ]
      // Vorteige ohne Gärzeit (z. B. ohne Hefe) fehlen im Zeitplan; sie erscheinen ohne Uhrzeit
      // vor dem Kneten, damit ihre Mengen und der Hinweis sichtbar bleiben.
      const untimed = r.vorteige
        .filter((v) => !plan.some((step) => step.kind === 'vorteig' && step.refId === v.id))
        .map((v): PlanStep => ({ kind: 'vorteig', refId: v.id }))
      const mixIndex = plan.findIndex((step) => step.kind === 'mix')
      plan.splice(mixIndex < 0 ? plan.length : mixIndex, 0, ...untimed)

      const details = (step: PlanStep): Pick<StepView, 'items' | 'note'> => {
        switch (step.kind) {
          case 'soakers':
            return {
              items: present(
                r.soakers
                  .filter((s) => fmt.has(s.dry))
                  .flatMap((s) => [
                    gramsItem(soakerLabel(s.id), s.dry),
                    gramsItem('Wasser', s.water),
                  ]),
              ),
              note: null,
            }
          case 'starter': {
            const s = r.starter
            if (!s) return { items: [], note: null }
            const reserve = s.reserve > 0 ? `, ${fmt.grams(s.reserve)} bleiben als Anstellgut` : ''
            return {
              items: present([
                gramsItem('Anstellgut', s.seed),
                gramsItem('Mehl', s.feedFlour),
                gramsItem('Wasser', s.feedWater),
              ]),
              note:
                `Reif nach ca. ${fmt.hours(r.starterProfile.ripeningHours)} bei ` +
                `${fmt.temp(r.starterProfile.temp)}. ${fmt.grams(s.forRecipe)} kommen in den Teig${reserve}.`,
            }
          }
          case 'vorteig': {
            const v = r.vorteige.find((item) => item.id === step.refId)
            if (!v) return { items: [], note: null }
            return {
              items: present([
                gramsItem('Mehl', v.flour),
                gramsItem('Wasser', v.water),
                gramsItem('Frischhefe', v.yeast, 2),
              ]),
              note:
                v.hours === null
                  ? 'Ohne Hefe bzw. Gärzeit gärt der Vorteig nicht.'
                  : `Reif nach ca. ${fmt.hours(v.hours)} bei ${fmt.temp(v.temp)}.`,
            }
          }
          case 'mix': {
            const m = r.main
            const waterTemp = r.waterTemperature.waterTemp
            const items = present([
              gramsItem(
                'Wasser',
                m.water,
                0,
                waterTemp === null ? '' : ` · ${fmt.temp(waterTemp)}`,
              ),
              r.starter ? gramsItem('Sauerteig', r.starter.forRecipe) : null,
              ...r.vorteige.map((v) => gramsItem(vorteigLabel(v.id), v.total)),
              gramsItem('Mehl', m.flour),
              ...r.soakers.map((s) => gramsItem(soakerLabel(s.id), s.total)),
              gramsItem('Salz', m.salt, 1),
              gramsItem('Frischhefe', m.yeast, 1),
              gramsItem('Malz', m.malt, 1),
              gramsItem('Öl/Fett', m.fat, 1),
            ])
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
