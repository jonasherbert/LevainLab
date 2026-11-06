import {
  soakerDefinitions,
  vorteigDefinitions,
  type SoakerKind,
  type VorteigType,
} from '@/types/dough'
import type { ScheduleStep } from '@/types/dough-result'

/** Bezeichnungen je ID; gleiche Bezeichnungen werden durchnummeriert („Poolish 1“, „Poolish 2“). */
export const itemLabels = <T extends { id: string }>(
  items: readonly T[],
  labelOf: (item: T) => string,
): Map<string, string> => {
  const totals = new Map<string, number>()
  for (const item of items) totals.set(labelOf(item), (totals.get(labelOf(item)) ?? 0) + 1)
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const item of items) {
    const base = labelOf(item)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    labels.set(item.id, (totals.get(base) ?? 0) > 1 ? `${base} ${n}` : base)
  }
  return labels
}

export const vorteigLabels = (vorteige: readonly { id: string; type: VorteigType }[]) =>
  itemLabels(vorteige, (v) => vorteigDefinitions[v.type].label)

export const soakerLabels = (soakers: readonly { id: string; kind: SoakerKind }[]) =>
  itemLabels(soakers, (s) => soakerDefinitions[s.kind].label)

export const scheduleStepLabel = (
  step: Pick<ScheduleStep, 'kind' | 'refId'>,
  vorteigLabel: (id: string) => string,
) => {
  switch (step.kind) {
    case 'soakers':
      return 'Einlagen ansetzen'
    case 'starter':
      return 'Sauerteig ansetzen'
    case 'vorteig':
      return `${step.refId ? vorteigLabel(step.refId) : 'Vorteig'} ansetzen`
    case 'mix':
      return 'Hauptteig kneten'
    case 'shape':
      return 'Formen'
    case 'fridge':
      return 'Formen und in den Kühlschrank'
    case 'bake':
      return 'Backen'
  }
}
