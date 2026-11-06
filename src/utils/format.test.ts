import { describe, expect, it } from 'vitest'
import {
  formatDayLabel,
  formatGrams,
  formatHours,
  formatInputNumber,
  formatNumber,
  formatPercent,
  formatTemp,
  hasAmount,
  parseDecimal,
} from './format'

const NBSP = ' '

describe('parseDecimal', () => {
  it('accepts comma and dot as decimal separator', () => {
    expect(parseDecimal('2,5')).toBe(2.5)
    expect(parseDecimal('2.5')).toBe(2.5)
    expect(parseDecimal(' 7,5 ')).toBe(7.5)
    expect(parseDecimal('2,')).toBe(2)
    expect(parseDecimal(',5')).toBe(0.5)
    expect(parseDecimal('-3')).toBe(-3)
  })

  it('treats the last separator as decimal separator', () => {
    expect(parseDecimal('1.000,5')).toBe(1000.5)
    expect(parseDecimal('1,000.5')).toBe(1000.5)
  })

  it('reads thousands grouping in integer fields', () => {
    expect(parseDecimal('1.000', { integer: true })).toBe(1000)
    expect(parseDecimal('12.500', { integer: true })).toBe(12500)
    expect(parseDecimal('1.000')).toBe(1)
  })

  it('rejects empty and invalid input', () => {
    for (const text of ['', '   ', '-', 'abc', '1e3', '2,5x', '--1']) {
      expect(parseDecimal(text)).toBeNull()
    }
  })
})

describe('formatting', () => {
  it('formats input values without grouping', () => {
    expect(formatInputNumber(1000, 0)).toBe('1000')
    expect(formatInputNumber(2.2, 2)).toBe('2,2')
    expect(formatInputNumber(2.256, 2)).toBe('2,26')
    expect(formatInputNumber(-0.0001, 1)).toBe('0')
  })

  it('formats output values with grouping and units', () => {
    expect(formatNumber(1772.4)).toBe('1.772')
    expect(formatNumber(2.2, 1)).toBe('2,2')
    expect(formatNumber(null)).toBe('–')
    expect(formatGrams(1015.8)).toBe(`1.016${NBSP}g`)
    expect(formatGrams(0.3, 2)).toBe(`0,30${NBSP}g`)
    expect(formatPercent(13.8)).toBe(`13,8${NBSP}%`)
    expect(formatTemp(17.3)).toBe(`17${NBSP}°C`)
    expect(formatHours(6.8965)).toBe(`6,9${NBSP}h`)
    expect(formatHours(null)).toBe('–')
  })

  it('labels days relative to the bake day', () => {
    expect(formatDayLabel(0)).toBe('Backtag')
    expect(formatDayLabel(-1)).toBe('Vortag')
    expect(formatDayLabel(-2)).toBe('2 Tage vorher')
  })

  it('hasAmount hides values that round to zero', () => {
    expect(hasAmount(0)).toBe(false)
    expect(hasAmount(0.4)).toBe(false)
    expect(hasAmount(0.4, 1)).toBe(true)
    expect(hasAmount(null)).toBe(false)
  })
})
