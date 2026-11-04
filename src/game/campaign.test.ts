import { describe, expect, it } from 'vitest'
import { applyPermanentRoster, freshCampaign, parseCampaign, purchaseUpgrade, recordContract, recordVictory, resolveEnding } from './campaign'
import { initialUnits } from './model'

describe('persistent campaign', () => {
  it('starts with only chapter one unlocked', () => expect(freshCampaign().unlocked).toBe(1))
  it('unlocks the next chapter and preserves casualties', () => {
    const next = recordVictory(freshCampaign(), 1, ['r3'])
    expect(next).toMatchObject({ unlocked: 2, completed: [1], casualties: ['r3'], supplies: 1 })
  })
  it('records one of two authored endings', () => {
    expect(recordVictory({ ...freshCampaign(), unlocked: 6 }, 6, [], 'zeal').ending).toBe('heir-coup')
  })
  it('recovers safely from corrupt storage', () => expect(parseCampaign('{broken')).toEqual(freshCampaign()))
  it('keeps dead named rabbits out and supplies weaker conscripts', () => {
    const roster = applyPermanentRoster(initialUnits(2), ['r3'])
    expect(roster.some((unit) => unit.id === 'r3')).toBe(false)
    expect(roster.find((unit) => unit.id === 'conscript-r3')?.maxHp).toBe(62)
  })
  it('uses campaign history to change the consequence of the same final choice', () => {
    const merciful = { ...freshCampaign(), choices: { 1: 'mercy', 2: 'mercy' } as const }
    const zealous = { ...freshCampaign(), choices: { 1: 'zeal', 2: 'zeal' } as const }
    expect(resolveEnding(merciful, 'mercy')).not.toBe(resolveEnding(zealous, 'mercy'))
  })
  it('migrates version one saves and preserves the best contract score', () => {
    const migrated = parseCampaign(JSON.stringify({ version:1, unlocked:3, completed:[1,2], choices:{}, casualties:[] }))
    expect(migrated.version).toBe(2)
    expect(recordContract(recordContract(migrated, 'no-quarter', 400), 'no-quarter', 250).contracts['no-quarter']).toBe(400)
  })
  it('spends supplies once on persistent tactical upgrades', () => {
    const funded = { ...freshCampaign(), supplies: 3 }
    const bought = purchaseUpgrade(funded, 'stitched-coats')
    expect(bought).toMatchObject({ supplies:1, upgrades:['stitched-coats'] })
    expect(purchaseUpgrade(bought, 'stitched-coats')).toEqual(bought)
  })
})
