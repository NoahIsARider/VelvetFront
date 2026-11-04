import { describe, expect, it } from 'vitest'
import { advanceAltarRitual, advanceChapelOccupation, isMissionComplete, OBJECTIVE_TARGETS, withinInteractionRange, type ObjectiveState } from './objectives'

const base: ObjectiveState = { collectedBlood: 0, elapsedTicks: 0, occupation: 0, extractorHp: 100, sealedBurrows: 0, bossDead: false, courierAtAltar: false, enemiesAlive: 0 }

describe('mission objective state machines', () => {
  it('requires four manually collected blood jars and active survival', () => expect(isMissionComplete(1, { ...base, collectedBlood: 4, elapsedTicks: 600 })).toBe(true))
  it('requires the bait convoy survival timer', () => expect(isMissionComplete(2, { ...base, elapsedTicks: 1800 })).toBe(true))
  it('requires sustained chapel occupation', () => expect(isMissionComplete(3, { ...base, occupation: 600 })).toBe(true))
  it('requires a surviving extractor at the time limit', () => {
    expect(isMissionComplete(4, { ...base, elapsedTicks: 2400, extractorHp: 1 })).toBe(true)
    expect(isMissionComplete(4, { ...base, elapsedTicks: 2400, extractorHp: 0 })).toBe(false)
  })
  it('requires all nursery burrows sealed and the counterattack cleared', () => expect(isMissionComplete(5, { ...base, sealedBurrows: 3, elapsedTicks: 900 })).toBe(true))
  it('requires both the dead boss and blood delivery ritual', () => {
    expect(isMissionComplete(6, { ...base, occupation: 400, bossDead: true, courierAtAltar: true })).toBe(true)
    expect(isMissionComplete(6, { ...base, occupation: 400, bossDead: false, courierAtAltar: true })).toBe(false)
  })
  it('rejects remote objective interaction', () => {
    expect(withinInteractionRange({ x: 10, y: 10 }, { x: 50, y: 50 })).toBe(false)
    expect(withinInteractionRange({ x: 46, y: 46 }, { x: 50, y: 50 })).toBe(true)
  })
  it('lets both long-form progress loops reach the exact completion thresholds', () => {
    let chapel = 0; for (let i = 0; i < OBJECTIVE_TARGETS.chapelOccupation; i++) chapel = advanceChapelOccupation(chapel, true)
    let altar = 0; for (let i = 0; i < OBJECTIVE_TARGETS.altarRitual; i++) altar = advanceAltarRitual(altar, true)
    expect(chapel).toBe(OBJECTIVE_TARGETS.chapelOccupation)
    expect(altar).toBe(OBJECTIVE_TARGETS.altarRitual)
  })
})
