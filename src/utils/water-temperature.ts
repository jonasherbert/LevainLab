import { sumBy } from './numbers'

/** Spezifische Wärmekapazität in J/(g·K). */
export const SPECIFIC_HEAT_WATER = 4.18
export const SPECIFIC_HEAT_DRY = 1.7

/** Außerhalb dieses Bereichs ist die Wassertemperatur kaum umsetzbar oder schadet dem Trieb. */
export const WATER_TEMP_MIN = 2
export const WATER_TEMP_MAX = 45

export interface HeatComponent {
  dry: number
  water: number
  temp: number
}

const heatCapacity = (component: { dry: number; water: number }): number =>
  component.dry * SPECIFIC_HEAT_DRY + component.water * SPECIFIC_HEAT_WATER

export interface WaterTemperatureInput {
  targetTemp: number
  frictionRise: number
  waterMass: number
  components: readonly HeatComponent[]
}

/**
 * Wärmebilanz: Welche Temperatur braucht das Schüttwasser, damit der Teig nach dem Kneten
 * (inkl. Knetwärme) die Zieltemperatur hat? null ohne Schüttwasser.
 */
export const calcWaterTemperature = (input: WaterTemperatureInput): number | null => {
  if (!(input.waterMass > 0)) return null
  const waterCapacity = input.waterMass * SPECIFIC_HEAT_WATER
  const otherCapacity = sumBy(input.components, heatCapacity)
  const otherHeat = sumBy(input.components, (c) => heatCapacity(c) * c.temp)
  const mixTemp = input.targetTemp - input.frictionRise
  return (mixTemp * (waterCapacity + otherCapacity) - otherHeat) / waterCapacity
}
