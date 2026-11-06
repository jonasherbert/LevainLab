import { describe, expect, it } from 'vitest'
import type { DoughWarning } from '@/types/dough-result'
import { itemLabels, scheduleStepLabel, vorteigLabels } from './labels'
import { describeWarning } from './warning-text'

const label = () => 'Poolish'

describe('describeWarning', () => {
  it('names only the sources that contribute to an overflow', () => {
    const view = describeWarning(
      { code: 'flour-overflow', excess: 100, sources: { starter: 300, vorteige: 0, soakers: 50 } },
      label,
    )
    expect(view.severity).toBe('error')
    expect(view.text).toContain('Sauerteig 300')
    expect(view.text).toContain('Einlagen 50')
    expect(view.text).not.toContain('Vorteige 0')
  })

  it('suggests a higher fermentation temperature for ice-cold water', () => {
    expect(
      describeWarning({ code: 'water-temp-out-of-range', waterTemp: -4 }, label).text,
    ).toContain('höhere')
    expect(
      describeWarning({ code: 'water-temp-out-of-range', waterTemp: 50 }, label).text,
    ).toContain('niedrigere')
  })

  it('has a text and a unique key for every code', () => {
    const warnings: DoughWarning[] = [
      { code: 'flour-overflow', excess: 1, sources: { starter: 1, vorteige: 0, soakers: 0 } },
      { code: 'water-overflow', excess: 1, sources: { starter: 1, vorteige: 0, soakers: 0 } },
      { code: 'vorteig-oversupply', plannedHours: 8, estimatedHours: 6.3 },
      { code: 'fridge-overproof', progress: 1.8 },
      { code: 'no-leavening' },
      { code: 'no-fermentation-time' },
      { code: 'vorteig-no-yeast', vorteigId: 'a' },
      { code: 'vorteig-no-time', vorteigId: 'b' },
      { code: 'sourdough-implausible', percent: 60 },
      { code: 'yeast-implausible', percent: 5, vorteigId: null },
      { code: 'water-temp-out-of-range', waterTemp: 50 },
      { code: 'altbrot-high', percent: 20 },
    ]
    const views = warnings.map((w) => describeWarning(w, label))
    expect(new Set(views.map((v) => v.key)).size).toBe(warnings.length)
    for (const view of views) expect(view.text.length).toBeGreaterThan(20)
  })
})

describe('labels', () => {
  it('numbers repeated labels', () => {
    const labels = vorteigLabels([
      { id: 'a', type: 'poolish' },
      { id: 'b', type: 'biga' },
      { id: 'c', type: 'poolish' },
    ])
    expect([...labels.values()]).toEqual(['Poolish 1', 'Biga', 'Poolish 2'])
    expect(itemLabels([], () => 'x').size).toBe(0)
  })

  it('labels schedule steps', () => {
    const step = {
      kind: 'vorteig',
      refId: 'a',
      hoursBeforeBake: 20,
      dayOffset: -1,
      time: '22:00',
    } as const
    expect(scheduleStepLabel(step, () => 'Poolish')).toBe('Poolish ansetzen')
    expect(scheduleStepLabel({ ...step, kind: 'fridge', refId: null }, () => '')).toBe(
      'Formen und in den Kühlschrank',
    )
  })
})
