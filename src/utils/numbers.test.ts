import { describe, expect, it } from 'vitest'
import { clamp, isFiniteNumber, roundTo, sumBy } from './numbers'

describe('numbers', () => {
  it('isFiniteNumber accepts only finite numbers', () => {
    expect(isFiniteNumber(12)).toBe(true)
    expect(isFiniteNumber(0)).toBe(true)
    for (const value of ['12', '', null, undefined, NaN, Infinity, {}]) {
      expect(isFiniteNumber(value)).toBe(false)
    }
  })

  it('clamp limits to the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('roundTo rounds and never returns -0', () => {
    expect(roundTo(2.25, 1)).toBe(2.3)
    expect(roundTo(1234.5678, 0)).toBe(1235)
    expect(Object.is(roundTo(-0.0001, 2), 0)).toBe(true)
  })

  it('sumBy sums picked values', () => {
    expect(sumBy([{ a: 1 }, { a: 2.5 }], (x) => x.a)).toBe(3.5)
    expect(sumBy([], () => 1)).toBe(0)
  })
})
