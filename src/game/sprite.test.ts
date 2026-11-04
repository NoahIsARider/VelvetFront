import { describe, expect, it } from 'vitest'
import type { Unit } from './model'
import { resolveRabbitDeathFrame, resolveSpriteFrame } from './sprite'

const enemy = (facing: 1 | -1, role: Unit['role'] = 'beast', state: Unit['state'] = 'walk'): Unit => ({
  id: 'enemy', team: 'beast', role, x: 50, y: 50, hp: 100, maxHp: 100,
  morale: 100, state, cooldown: 0, facing,
})

describe('sprite orientation and role atlas mapping', () => {
  it('flips the right-authored boar master while it moves left', () => {
    expect(resolveSpriteFrame(enemy(-1), 0).facingScale).toBe(-1)
  })

  it('keeps the right-authored boar master unflipped while it moves right', () => {
    expect(resolveSpriteFrame(enemy(1), 0).facingScale).toBe(1)
  })

  it('alternates idle and stride art instead of translating a frozen enemy', () => {
    expect(resolveSpriteFrame(enemy(-1), 0).col).toBe(0)
    expect(resolveSpriteFrame(enemy(-1), 1).col).toBe(1)
  })

  it('keeps the separately authored left-facing boss correct', () => expect(resolveSpriteFrame(enemy(-1, 'boss'), 0).facingScale).toBe(1))

  it('maps each enemy role to its own row and death to the final pose', () => {
    expect(resolveSpriteFrame(enemy(-1, 'stalker'), 0).row).toBe(1)
    expect(resolveSpriteFrame(enemy(-1, 'brute'), 0).row).toBe(2)
    expect(resolveSpriteFrame(enemy(-1, 'boss', 'dead'), 0)).toMatchObject({ row: 3, col: 3 })
  })
})

describe('rabbit death animation', () => {
  it('plays the fall once and then holds one stable frame per decay stage', () => {
    expect(resolveRabbitDeathFrame(0)).toEqual({ row: 0, col: 0 })
    expect(resolveRabbitDeathFrame(540)).toEqual({ row: 0, col: 3 })
    expect(resolveRabbitDeathFrame(900)).toEqual({ row: 1, col: 3 })
    expect(resolveRabbitDeathFrame(7000)).toEqual({ row: 2, col: 3 })
    expect(resolveRabbitDeathFrame(15000)).toEqual({ row: 3, col: 3 })
  })
})
