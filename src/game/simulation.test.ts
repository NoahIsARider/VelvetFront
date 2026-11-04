import { describe, expect, it } from 'vitest'
import { initialUnits } from './model'
import { tickSimulation } from './simulation'
import type { Unit } from './model'

describe('combat simulation', () => {
  it('moves beasts toward living rabbits', () => {
    const units = initialUnits(1)
    const beast = units.find((unit) => unit.id === 'b1')!
    const before = beast.x
    const next = tickSimulation(units, 1).units.find((unit) => unit.id === 'b1')!
    expect(next.x).toBeLessThan(before)
  })

  it('marks units dead at zero health', () => {
    const units = initialUnits(1)
    units[0].hp = 0
    const next = tickSimulation(units, 1).units[0]
    expect(next.state).toBe('dead')
  })

  it('never targets a rabbit killed earlier in the same tick', () => {
    const victim: Unit = { id: 'victim', team: 'rabbit', role: 'rifle', x: 50, y: 50, hp: 1, maxHp: 100, morale: 100, state: 'idle', cooldown: 0, facing: 1 }
    const survivor: Unit = { ...victim, id: 'survivor', x: 52, hp: 100 }
    const attackerA: Unit = { id: 'a', team: 'beast', role: 'beast', x: 49, y: 50, hp: 100, maxHp: 100, morale: 100, state: 'idle', cooldown: 0, facing: -1 }
    const attackerB: Unit = { ...attackerA, id: 'b', x: 48 }
    const next = tickSimulation([victim, survivor, attackerA, attackerB], 6).units
    expect(next.find((unit) => unit.id === 'victim')!.hp).toBe(0)
    expect(next.find((unit) => unit.id === 'survivor')!.hp).toBeLessThan(100)
  })

  it('makes stalkers prioritize the medic', () => {
    const stalker: Unit = { id: 's', team: 'beast', role: 'stalker', x: 50, y: 50, hp: 100, maxHp: 100, morale: 100, state: 'idle', cooldown: 5, facing: -1 }
    const rifle: Unit = { id: 'r', team: 'rabbit', role: 'rifle', x: 49, y: 50, hp: 100, maxHp: 100, morale: 100, state: 'idle', cooldown: 0, facing: 1 }
    const medic: Unit = { ...rifle, id: 'm', role: 'medic', x: 70 }
    const next = tickSimulation([stalker, rifle, medic], 2).units.find((unit) => unit.id === 's')!
    expect(next.x).toBeGreaterThan(50)
  })

  it('makes brutes deliberately damage protected machinery', () => {
    const brute: Unit = { id: 'b', team: 'beast', role: 'brute', x: 50, y: 50, hp: 240, maxHp: 240, morale: 100, state: 'idle', cooldown: 0, facing: -1 }
    const rabbit: Unit = { id: 'r', team: 'rabbit', role: 'rifle', x: 10, y: 10, hp: 100, maxHp: 100, morale: 100, state: 'idle', cooldown: 0, facing: 1 }
    expect(tickSimulation([brute, rabbit], 3, { objective: { x: 51, y: 50, priority: 'brute' } }).objectiveDamage).toBeGreaterThan(0)
  })

  it('telegraphs two boss phases based on health', () => {
    const boss: Unit = { id: 'boss', team: 'beast', role: 'boss', x: 50, y: 50, hp: 420, maxHp: 420, morale: 100, state: 'idle', cooldown: 0, facing: -1 }
    const rabbit: Unit = { id: 'r', team: 'rabbit', role: 'rifle', x: 55, y: 50, hp: 100, maxHp: 100, morale: 100, state: 'idle', cooldown: 0, facing: 1 }
    expect(tickSimulation([boss, rabbit], 4).units[0].ability).toBe('charge')
    boss.hp = 150
    expect(tickSimulation([boss, rabbit], 5).units[0].ability).toBe('shock')
  })

  it('separates same-team silhouettes and their attached health bars', () => {
    const a: Unit = { id:'a',team:'beast',role:'beast',x:50,y:50,hp:100,maxHp:100,morale:100,state:'idle',cooldown:5,facing:-1 }
    const b: Unit = { ...a, id:'b', x:50.5 }
    const rabbit: Unit = { id:'r',team:'rabbit',role:'rifle',x:10,y:10,hp:100,maxHp:100,morale:100,state:'idle',cooldown:0,facing:1 }
    const next = tickSimulation([a,b,rabbit], 7).units
    expect(Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y)).toBeGreaterThanOrEqual(10.4)
  })

  it('keeps living beasts out of corpse and blood-jar space', () => {
    const living: Unit = { id:'b1',team:'beast',role:'beast',x:50,y:50,hp:100,maxHp:100,morale:100,state:'idle',cooldown:5,facing:-1 }
    const corpse: Unit = { ...living, id:'b2', x:50.2, hp:0, state:'dead', deadSince:1 }
    const rabbit: Unit = { id:'r',team:'rabbit',role:'rifle',x:10,y:10,hp:100,maxHp:100,morale:100,state:'idle',cooldown:0,facing:1 }
    const next = tickSimulation([living, corpse, rabbit], 8).units
    expect(Math.hypot(next[0].x-next[1].x,next[0].y-next[1].y)).toBeGreaterThanOrEqual(10.4)
  })
})
