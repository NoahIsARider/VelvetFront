import { describe, expect, it } from 'vitest'
import { createWave, waveSchedule } from './waves'

describe('authored reinforcement waves', () => {
  it('gives every chapter multiple timed waves', () => {
    for (let mission = 1; mission <= 6; mission++) expect(waveSchedule(mission).length).toBeGreaterThanOrEqual(2)
  })
  it('uses unique mission and wave ids', () => {
    expect(createWave(3, 2).map((unit) => unit.id)).toEqual(['m3-wave2-0', 'm3-wave2-1', 'm3-wave2-2'])
  })
  it('changes composition and pressure between authored phases', () => {
    expect(createWave(4, 0).map((unit) => unit.role)).not.toEqual(createWave(4, 1).map((unit) => unit.role))
    expect(new Set(createWave(4, 3).map((unit) => unit.role)).size).toBeGreaterThan(2)
  })
})
