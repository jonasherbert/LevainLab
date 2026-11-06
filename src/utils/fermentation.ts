/**
 * Gärmodell.
 *
 * Jedes Triebmittel folgt einem Potenzgesetz: Für eine effektive Gärzeit t_eff (Stunden bei 24 °C)
 * braucht man die Menge p(t_eff) = p_ref · (t_ref / t_eff)^a. Der Gärfortschritt einer Menge p ist
 * f = (p / p_ref) · (t_eff / t_ref)^a; der Teig ist reif, wenn die Summe aller Fortschritte 1 ist.
 * Mit a > 1 gilt: halbe Menge braucht nicht doppelt so lange, sondern nur etwas länger.
 *
 * Alle Konstanten sind Startwerte aus gängigen Backerfahrungen und lassen sich hier mit eigenen
 * Backergebnissen nachkalibrieren.
 */
import type { DoughWarning, LeaveningProgress, LeaveningResult } from '@/types/dough-result'
import type { DoughState, FermentationSettings, MaltType, VorteigType } from '@/types/dough'
import { clamp, sumBy } from './numbers'

export const T_REF = 24
export const Q10 = { sourdough: 4, yeast: 3 } as const
export type LeaveningAgent = keyof typeof Q10

/** Über 35 °C steigt die Aktivität nicht weiter; die Q10-Kurve würde sonst endlos wachsen. */
export const MODEL_TEMP_MIN = 0
export const MODEL_TEMP_MAX = 35

export interface LeaveningReference {
  agent: LeaveningAgent
  /** Menge, die in `effHours` reif wird (% vom bezogenen Mehl). */
  percent: number
  effHours: number
  exponent: number
}

/** Relative Gärgeschwindigkeit gegenüber 24 °C. */
export const fermentationRate = (agent: LeaveningAgent, tempC: number): number =>
  Math.pow(Q10[agent], (clamp(tempC, MODEL_TEMP_MIN, MODEL_TEMP_MAX) - T_REF) / 10)

/** 20 % Versäuerungsgrad sind nach ca. 4,55 h bei 24 °C reif (Stock- + Stückgare). */
export const SOURDOUGH_REF: LeaveningReference = {
  agent: 'sourdough',
  percent: 20,
  effHours: 4.55,
  exponent: 2.5,
}

/** 0,188 % Frischhefe (vom Gesamtmehl) sind nach 8 h bei 21 °C reif. */
export const YEAST_REF: LeaveningReference = {
  agent: 'yeast',
  percent: 0.188,
  effHours: 8 * fermentationRate('yeast', 21),
  exponent: 2,
}

/** Vorteige: Hefe in % vom Vorteigmehl. Eine feste Biga braucht viel mehr Hefe als eine Poolish. */
export const VORTEIG_REFS: Record<VorteigType, LeaveningReference> = {
  poolish: {
    agent: 'yeast',
    percent: 0.1,
    effHours: 12 * fermentationRate('yeast', 20),
    exponent: 2,
  },
  biga: { agent: 'yeast', percent: 1, effHours: 18 * fermentationRate('yeast', 18), exponent: 2 },
}

/** Ein Sauerteig mit 20 % Anstellgut-Mehlanteil (1:2:2) ist nach ca. 6 h bei 24 °C reif. */
export const STARTER_RIPENING_REF = { seedFlourFraction: 0.2, hours: 6, exponent: 2.5 } as const

export const MALT_ACCEL_PER_PERCENT = 0.15
export const MALT_ACCEL_MAX_PERCENT = 3

/**
 * Vorteig-Hefe zählt im Hauptteig mit ihrer Anfangsdosis. Ihr Wachstum im Vorteig ist nicht
 * berücksichtigt, der Teig wird dadurch eher etwas früher reif als berechnet.
 */
export const VORTEIG_YEAST_ACTIVITY = 1

/** Zeitkonstante, mit der ein geformter Teigling im Kühlschrank abkühlt. */
export const FRIDGE_COOLING_TAU_HOURS = 2
export const FRIDGE_INTEGRATION_STEPS = 240

/**
 * Effektive Stunden im Kühlschrank: Der Teig kühlt von der Gärtemperatur exponentiell auf die
 * Kühlschranktemperatur ab und gärt in dieser Zeit noch merklich weiter.
 */
export const fridgeEffectiveHours = (
  agent: LeaveningAgent,
  hours: number,
  startTemp: number,
  fridgeTemp: number,
): number => {
  if (!(hours > 0)) return 0
  const tau = FRIDGE_COOLING_TAU_HOURS
  const cutoff = 12 * tau
  const span = Math.min(hours, cutoff)
  const steps = FRIDGE_INTEGRATION_STEPS
  const dt = span / steps
  const rateAt = (t: number) =>
    fermentationRate(agent, fridgeTemp + (startTemp - fridgeTemp) * Math.exp(-t / tau))
  let sum = rateAt(0) + rateAt(span)
  for (let i = 1; i < steps; i++) sum += rateAt(i * dt) * (i % 2 === 0 ? 2 : 4)
  const tail = Math.max(0, hours - cutoff) * fermentationRate(agent, fridgeTemp)
  return (sum * dt) / 3 + tail
}

export const maltFactor = (percent: number, type: MaltType): number =>
  type === 'active' ? 1 + MALT_ACCEL_PER_PERCENT * clamp(percent, 0, MALT_ACCEL_MAX_PERCENT) : 1

/** Effektive Stunden als Gerade über der Raumgare: offset + slope · Raumstunden. */
export interface EffectiveHoursLine {
  slope: number
  offset: number
}

export const effectiveHoursLine = (
  agent: LeaveningAgent,
  fermentation: FermentationSettings,
  malt: number,
): EffectiveHoursLine => ({
  slope: fermentationRate(agent, fermentation.roomTemp) * malt,
  offset:
    fridgeEffectiveHours(
      agent,
      fermentation.fridgeHours,
      fermentation.roomTemp,
      fermentation.fridgeTemp,
    ) * malt,
})

export const effectiveHoursAt = (line: EffectiveHoursLine, roomHours: number): number =>
  line.offset + line.slope * roomHours

export const leaveningProgress = (
  ref: LeaveningReference,
  percent: number,
  effHours: number,
): number =>
  percent > 0 && effHours > 0
    ? (percent / ref.percent) * Math.pow(effHours / ref.effHours, ref.exponent)
    : 0

export const requiredPercent = (ref: LeaveningReference, effHours: number): number | null =>
  effHours > 0 ? ref.percent * Math.pow(ref.effHours / effHours, ref.exponent) : null

export const readyEffHours = (ref: LeaveningReference, percent: number): number | null =>
  percent > 0 ? ref.effHours * Math.pow(ref.percent / percent, 1 / ref.exponent) : null

export interface LeaveningDose {
  ref: LeaveningReference
  percent: number
  line: EffectiveHoursLine
}

/**
 * Raumgare, nach der die Summe aller Fortschritte 1 erreicht. 0, wenn schon die Kühlschrankgare
 * reicht; null ohne Triebmittel.
 */
export const solveRoomHours = (doses: readonly LeaveningDose[]): number | null => {
  const active = doses.filter((d) => d.percent > 0)
  if (active.length === 0) return null
  const progressAt = (roomHours: number) =>
    sumBy(active, (d) => leaveningProgress(d.ref, d.percent, effectiveHoursAt(d.line, roomHours)))
  if (progressAt(0) >= 1) return 0
  // Obergrenze: das Triebmittel, das allein am schnellsten reif wäre.
  let high = Infinity
  for (const d of active) {
    const ready = readyEffHours(d.ref, d.percent)
    if (ready !== null && d.line.slope > 0) {
      high = Math.min(high, (ready - d.line.offset) / d.line.slope)
    }
  }
  if (!Number.isFinite(high)) return null
  let low = 0
  for (let i = 0; i < 100 && high - low > 1e-9; i++) {
    const mid = (low + high) / 2
    if (progressAt(mid) >= 1) high = mid
    else low = mid
  }
  return high
}

/** Hefe in % vom Vorteigmehl für eine Gärzeit; null ohne Zeit. */
export const vorteigYeastForHours = (
  type: VorteigType,
  hours: number,
  temp: number,
): number | null => requiredPercent(VORTEIG_REFS[type], hours * fermentationRate('yeast', temp))

/** Gärzeit eines Vorteigs für eine Hefemenge (% vom Vorteigmehl); null ohne Hefe. */
export const vorteigHoursForYeast = (
  type: VorteigType,
  percent: number,
  temp: number,
): number | null => {
  const effHours = readyEffHours(VORTEIG_REFS[type], percent)
  return effHours === null ? null : effHours / fermentationRate('yeast', temp)
}

/** Mehlanteil des Anstellguts an allem Mehl im angesetzten Sauerteig. */
export const starterSeedFlourFraction = (flourParts: number, waterParts: number): number =>
  1 / (1 + flourParts + waterParts)

/** Reifezeit des angesetzten Sauerteigs in Stunden bei `temp`. */
export const starterRipeningHours = (
  flourParts: number,
  waterParts: number,
  temp: number,
): number => {
  const share = starterSeedFlourFraction(flourParts, waterParts)
  const ref = STARTER_RIPENING_REF
  const effHours = ref.hours * Math.pow(ref.seedFlourFraction / share, 1 / ref.exponent)
  return effHours / fermentationRate('sourdough', temp)
}

export interface ResolvedVorteig {
  id: string
  /** % vom Vorteigmehl. */
  yeastPercent: number
  hours: number | null
}

export interface LeaveningCalculation {
  leavening: LeaveningResult
  vorteige: ResolvedVorteig[]
  warnings: DoughWarning[]
}

/** Bestimmt Versäuerungsgrad, Hefe und Raumgare – je nach Modus als Eingabe oder Ergebnis. */
export const calcLeavening = (state: DoughState): LeaveningCalculation => {
  const f = state.fermentation
  const malt = maltFactor(state.maltPercent, state.maltType)
  const sourdoughLine = effectiveHoursLine('sourdough', f, malt)
  const yeastLine = effectiveHoursLine('yeast', f, malt)
  const warnings: DoughWarning[] = []

  const vorteige = state.vorteige.map((v): ResolvedVorteig => {
    if (f.mode === 'time') {
      const yeastPercent = vorteigYeastForHours(v.type, v.fermentationHours, v.fermentationTemp)
      if (yeastPercent === null) warnings.push({ code: 'vorteig-no-time', vorteigId: v.id })
      return {
        id: v.id,
        yeastPercent: yeastPercent ?? 0,
        hours: yeastPercent === null ? null : v.fermentationHours,
      }
    }
    const hours = vorteigHoursForYeast(v.type, v.yeastPercent, v.fermentationTemp)
    if (hours === null) warnings.push({ code: 'vorteig-no-yeast', vorteigId: v.id })
    return { id: v.id, yeastPercent: v.yeastPercent, hours }
  })

  const vorteigYeastPercent =
    state.vorteige.reduce(
      (sum, v, i) => sum + (v.flourPercent * (vorteige[i]?.yeastPercent ?? 0)) / 100,
      0,
    ) * VORTEIG_YEAST_ACTIVITY

  const base = {
    mode: f.mode,
    vorteigYeastPercent,
    fridgeHours: f.fridgeHours,
    maltFactor: malt,
  }

  if (f.mode === 'time') {
    const roomHours = f.roomHours
    const sourdoughEff = effectiveHoursAt(sourdoughLine, roomHours)
    const yeastEff = effectiveHoursAt(yeastLine, roomHours)
    if (!(sourdoughEff > 0) || !(yeastEff > 0)) {
      warnings.push({ code: 'no-fermentation-time' })
      return {
        leavening: {
          ...base,
          sourdoughPercent: 0,
          yeastPercent: 0,
          sourdoughShare: f.sourdoughShare,
          roomHours,
          progress: null,
          usesSourdough: false,
        },
        vorteige,
        warnings,
      }
    }
    const vorteigProgress = leaveningProgress(YEAST_REF, vorteigYeastPercent, yeastEff)
    const remaining = Math.max(0, 1 - vorteigProgress)
    const share = f.sourdoughShare / 100
    const sourdoughPercent = share * remaining * (requiredPercent(SOURDOUGH_REF, sourdoughEff) ?? 0)
    const yeastPercent = (1 - share) * remaining * (requiredPercent(YEAST_REF, yeastEff) ?? 0)
    if (vorteigProgress > 1) {
      warnings.push({
        code: 'vorteig-oversupply',
        plannedHours: roomHours,
        estimatedHours: solveRoomHours([
          { ref: YEAST_REF, percent: vorteigYeastPercent, line: yeastLine },
        ]),
      })
    }
    return {
      leavening: {
        ...base,
        sourdoughPercent,
        yeastPercent,
        sourdoughShare: f.sourdoughShare,
        roomHours,
        progress: {
          sourdough: share * remaining,
          yeast: (1 - share) * remaining,
          vorteige: vorteigProgress,
        },
        usesSourdough: sourdoughPercent > 0,
      },
      vorteige,
      warnings,
    }
  }

  const sourdoughPercent = state.starter.percent
  const yeastPercent = state.yeastPercent
  const roomHours = solveRoomHours([
    { ref: SOURDOUGH_REF, percent: sourdoughPercent, line: sourdoughLine },
    { ref: YEAST_REF, percent: yeastPercent, line: yeastLine },
    { ref: YEAST_REF, percent: vorteigYeastPercent, line: yeastLine },
  ])

  let progress: LeaveningProgress | null = null
  if (roomHours === null) {
    warnings.push({ code: 'no-leavening' })
  } else {
    progress = {
      sourdough: leaveningProgress(
        SOURDOUGH_REF,
        sourdoughPercent,
        effectiveHoursAt(sourdoughLine, roomHours),
      ),
      yeast: leaveningProgress(YEAST_REF, yeastPercent, effectiveHoursAt(yeastLine, roomHours)),
      vorteige: leaveningProgress(
        YEAST_REF,
        vorteigYeastPercent,
        effectiveHoursAt(yeastLine, roomHours),
      ),
    }
    const total = progress.sourdough + progress.yeast + progress.vorteige
    if (roomHours === 0 && total > 1 + 1e-9) {
      warnings.push({ code: 'fridge-overproof', progress: total })
    }
  }

  const ownProgress = progress ? progress.sourdough + progress.yeast : 0
  return {
    leavening: {
      ...base,
      sourdoughPercent,
      yeastPercent,
      sourdoughShare:
        progress && ownProgress > 0 ? (100 * progress.sourdough) / ownProgress : f.sourdoughShare,
      roomHours,
      progress,
      usesSourdough: sourdoughPercent > 0,
    },
    vorteige,
    warnings,
  }
}
