import { describe, expect, it } from 'vitest'
import { advanceOnTerrain, incomingDamageMultiplier, movementMultiplier, obstacleAt, resolveDestination, terrainAt } from './terrain'

describe('battlefield terrain', () => {
  it('gives all six missions meaningful obstacles and terrain', () => {
    for (let mission = 1; mission <= 6; mission++) {
      expect(obstacleAt(mission, mission === 1 ? { x:15,y:32 } : mission === 2 ? { x:22,y:31 } : mission === 3 ? { x:18,y:24 } : mission === 4 ? { x:23,y:33 } : mission === 5 ? { x:24,y:28 } : { x:19,y:31 })).toBeTruthy()
    }
  })

  it('projects blocked move orders outside scenery', () => {
    const result = resolveDestination(1, { x:30,y:40 }, { x:15,y:32 })
    expect(result.blockedBy).toBe('burning chapel')
    expect(obstacleAt(1, result.point)).toBeUndefined()
  })

  it('makes mud slow rabbits more than beasts and cover reduce damage', () => {
    expect(terrainAt(1, { x:55,y:52 })).toBe('mud')
    expect(movementMultiplier(1, { x:55,y:52 }, 'rabbit')).toBeLessThan(movementMultiplier(1, { x:55,y:52 }, 'beast'))
    expect(incomingDamageMultiplier(1, { x:24,y:58 })).toBeLessThan(1)
  })

  it('routes a movement step around an obstacle', () => {
    const next = advanceOnTerrain(1, 'rabbit', { x:26,y:32 }, { x:10,y:32 }, 2)
    expect(obstacleAt(1, next)).toBeUndefined()
  })
})
