import { describe, expect, it } from 'vitest'
import { buildSchedule, formatClockTime, parseClockTime, type ScheduleInput } from './schedule'

const input = (patch: Partial<ScheduleInput> = {}): ScheduleInput => ({
  bakeTime: '18:00',
  roomHours: 6,
  fridgeHours: 0,
  proofHours: 1.5,
  starterHours: null,
  vorteige: [],
  hasSoakers: false,
  ...patch,
})

const summary = (patch: Partial<ScheduleInput>) =>
  buildSchedule(input(patch))?.steps.map(
    (s) => `${s.kind}${s.refId ? `:${s.refId}` : ''} ${s.dayOffset} ${s.time}`,
  )

describe('clock time', () => {
  it('parses and formats HH:MM', () => {
    expect(parseClockTime('07:30')).toBe(450)
    expect(parseClockTime('7:30')).toBe(450)
    expect(parseClockTime('24:00')).toBeNull()
    expect(parseClockTime('')).toBeNull()
    expect(formatClockTime(-25)).toBe('23:35')
    expect(formatClockTime(1440 + 65)).toBe('01:05')
  })
})

describe('buildSchedule', () => {
  it('plans backward from the bake time', () => {
    expect(summary({ roomHours: 6.89651, starterHours: 11.504778 })).toEqual([
      'starter -1 23:35',
      'mix 0 11:05',
      'shape 0 16:30',
      'bake 0 18:00',
    ])
  })

  it('shapes before the fridge phase', () => {
    expect(
      summary({
        bakeTime: '18:00',
        roomHours: 5,
        fridgeHours: 14,
        starterHours: 12,
        vorteige: [{ id: 'p', hours: 12 }],
        hasSoakers: true,
      }),
    ).toEqual([
      'soakers -1 11:00',
      'starter -1 11:00',
      'vorteig:p -1 11:00',
      'mix -1 23:00',
      'fridge 0 04:00',
      'bake 0 18:00',
    ])
  })

  it('handles midnight and multi-day plans', () => {
    expect(summary({ roomHours: 6, starterHours: 12 })?.[0]).toBe('starter 0 00:00')
    expect(summary({ bakeTime: '08:00', roomHours: 4, fridgeHours: 48 })).toEqual([
      'mix -2 04:00',
      'fridge -2 08:00',
      'bake 0 08:00',
    ])
  })

  it('soaks at least 4 h before mixing', () => {
    expect(summary({ bakeTime: '12:00', roomHours: 3, proofHours: 0, hasSoakers: true })).toEqual([
      'soakers 0 05:00',
      'mix 0 09:00',
      'bake 0 12:00',
    ])
  })

  it('skips Vorteige without time and never returns -0', () => {
    const result = buildSchedule(
      input({
        bakeTime: '00:00',
        roomHours: 0.03,
        proofHours: 0,
        vorteige: [{ id: 'x', hours: null }],
      }),
    )
    expect(result?.steps.map((s) => s.kind)).toEqual(['mix', 'bake'])
    expect(Object.is(result?.steps[0]?.dayOffset, 0)).toBe(true)
  })

  it('returns null without room hours or with an invalid time', () => {
    expect(buildSchedule(input({ roomHours: null }))).toBeNull()
    expect(buildSchedule(input({ bakeTime: 'abc' }))).toBeNull()
  })
})
