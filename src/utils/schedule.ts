import type { ScheduleResult, ScheduleStep, ScheduleStepKind } from '@/types/dough-result'

export const SCHEDULE_ROUNDING_MINUTES = 5
/** Einlagen brauchen mindestens so lange zum Quellen bzw. Abkühlen. */
export const SOAKER_MIN_LEAD_HOURS = 4

const MINUTES_PER_DAY = 1440
const STEP_ORDER: readonly ScheduleStepKind[] = [
  'soakers',
  'starter',
  'vorteig',
  'mix',
  'shape',
  'fridge',
  'bake',
]

export const parseClockTime = (value: string): number | null => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

export const formatClockTime = (minutes: number): string => {
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export interface ScheduleInput {
  bakeTime: string
  /** Raumgare (Stock- + Stückgare); null, wenn sie sich nicht bestimmen lässt. */
  roomHours: number | null
  fridgeHours: number
  /** Stückgare als Teil der Raumgare; nur ohne Kühlschrankgare relevant. */
  proofHours: number
  /** Reifezeit des Sauerteigs; null ohne Sauerteig. */
  starterHours: number | null
  vorteige: readonly { id: string; hours: number | null }[]
  hasSoakers: boolean
}

interface PlannedStep {
  kind: ScheduleStepKind
  refId: string | null
  hoursBeforeBake: number
}

/** Rechnet von der Backzeit rückwärts. */
export const buildSchedule = (input: ScheduleInput): ScheduleResult | null => {
  const bakeMinutes = parseClockTime(input.bakeTime)
  if (bakeMinutes === null || input.roomHours === null) return null

  const fridgeHours = Math.max(0, input.fridgeHours)
  const roomHours = Math.max(0, input.roomHours)
  const mixLead = fridgeHours + roomHours
  const planned: PlannedStep[] = [{ kind: 'bake', refId: null, hoursBeforeBake: 0 }]

  if (fridgeHours > 0) {
    planned.push({ kind: 'fridge', refId: null, hoursBeforeBake: fridgeHours })
  } else if (input.proofHours > 0 && roomHours > 0) {
    planned.push({
      kind: 'shape',
      refId: null,
      hoursBeforeBake: Math.min(input.proofHours, roomHours),
    })
  }
  planned.push({ kind: 'mix', refId: null, hoursBeforeBake: mixLead })

  const prepLeads: number[] = []
  if (input.starterHours !== null) {
    const lead = mixLead + input.starterHours
    prepLeads.push(lead)
    planned.push({ kind: 'starter', refId: null, hoursBeforeBake: lead })
  }
  for (const v of input.vorteige) {
    if (v.hours === null) continue
    const lead = mixLead + v.hours
    prepLeads.push(lead)
    planned.push({ kind: 'vorteig', refId: v.id, hoursBeforeBake: lead })
  }
  if (input.hasSoakers) {
    planned.push({
      kind: 'soakers',
      refId: null,
      hoursBeforeBake: Math.max(mixLead + SOAKER_MIN_LEAD_HOURS, ...prepLeads),
    })
  }

  const steps = planned
    .map((step): ScheduleStep => {
      const rawMinutes = bakeMinutes - step.hoursBeforeBake * 60
      const minutes =
        Math.round(rawMinutes / SCHEDULE_ROUNDING_MINUTES) * SCHEDULE_ROUNDING_MINUTES + 0
      return {
        ...step,
        dayOffset: Math.floor(minutes / MINUTES_PER_DAY) + 0,
        time: formatClockTime(minutes),
      }
    })
    .sort(
      (a, b) =>
        b.hoursBeforeBake - a.hoursBeforeBake ||
        STEP_ORDER.indexOf(a.kind) - STEP_ORDER.indexOf(b.kind),
    )

  return { bakeTime: input.bakeTime, steps }
}
