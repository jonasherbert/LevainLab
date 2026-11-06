import { describe, expect, it } from 'vitest'
import { calcWaterTemperature } from './water-temperature'

describe('calcWaterTemperature', () => {
  const flour = { dry: 1000, water: 0, temp: 20 }

  it('balances the heat of all components', () => {
    const input = { targetTemp: 26, frictionRise: 0, waterMass: 700, components: [flour] }
    expect(calcWaterTemperature(input)).toBeCloseTo(29.485988, 5)
  })

  it('subtracts the kneading friction', () => {
    const input = { targetTemp: 26, frictionRise: 4, waterMass: 700, components: [flour] }
    expect(calcWaterTemperature(input)).toBeCloseTo(23.161996, 5)
  })

  it('returns the target when everything already has it', () => {
    const input = {
      targetTemp: 21,
      frictionRise: 0,
      waterMass: 500,
      components: [
        { dry: 800, water: 0, temp: 21 },
        { dry: 200, water: 120, temp: 21 },
      ],
    }
    expect(calcWaterTemperature(input)).toBeCloseTo(21, 9)
  })

  it('returns null without water', () => {
    const input = { targetTemp: 26, frictionRise: 0, waterMass: 0, components: [flour] }
    expect(calcWaterTemperature(input)).toBeNull()
  })
})
