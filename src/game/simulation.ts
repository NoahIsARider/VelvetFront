import { clamp, distance, type CombatEvent, type Unit } from './model'
import { advanceOnTerrain, incomingDamageMultiplier, terrainAt } from './terrain'

export interface ObjectiveContext { x: number; y: number; priority: 'all' | 'brute' }
export interface SimulationContext { objective?: ObjectiveContext; mission?: number; rabbitDamage?: number; rabbitArmor?: number }
export interface TickResult { units: Unit[]; events: CombatEvent[]; objectiveDamage: number }

const moveToward = (unit: Unit, tx: number, ty: number, speed: number, mission = 0) => {
  const dx = tx - unit.x
  const next = advanceOnTerrain(mission, unit.team, unit, { x: tx, y: ty }, speed)
  unit.x = next.x
  unit.y = next.y
  unit.facing = dx >= 0 ? 1 : -1
}

export function tickSimulation(source: Unit[], now: number, context: SimulationContext = {}): TickResult {
  const units = source.map((unit) => ({ ...unit, cooldown: Math.max(0, unit.cooldown - 1) }))
  const events: CombatEvent[] = []
  const aliveRabbits = units.filter((u) => u.team === 'rabbit' && u.hp > 0)
  const aliveBeasts = units.filter((u) => u.team === 'beast' && u.hp > 0)
  let eventId = now
  let objectiveDamage = 0
  const mission = context.mission ?? 0

  for (const unit of units) {
    if (unit.hp <= 0) {
      unit.state = 'dead'
      unit.deadSince ??= now
      continue
    }
    if (unit.team === 'rabbit' && terrainAt(mission, unit) === 'blood-road') unit.morale = Math.max(0, unit.morale - .12)
    if (unit.role === 'boss' && unit.telegraph && unit.telegraph > 0) {
      unit.telegraph -= 1
      unit.state = 'attack'
      if (unit.telegraph === 0) {
        if (unit.ability === 'charge') {
          const victim = aliveRabbits.filter((rabbit) => distance(unit, rabbit) < 18).sort((a, b) => distance(unit, a) - distance(unit, b))[0]
          if (victim) { victim.hp = Math.max(0, victim.hp - 65); victim.state = victim.hp ? 'hurt' : 'dead'; victim.deadSince ??= victim.hp ? undefined : now }
          unit.x = clamp(unit.x - 12, 4, 96)
        } else {
          aliveRabbits.filter((rabbit) => distance(unit, rabbit) < 17).forEach((rabbit) => { rabbit.hp = Math.max(0, rabbit.hp - 44); rabbit.state = rabbit.hp ? 'hurt' : 'dead'; rabbit.deadSince ??= rabbit.hp ? undefined : now })
        }
        events.push({ id: eventId++, kind: 'blood', x: unit.x, y: unit.y, createdAt: now })
        unit.ability = undefined
        unit.cooldown = 24
      }
      continue
    }
    const enemies = (unit.team === 'rabbit' ? aliveBeasts : aliveRabbits).filter((candidate) => candidate.hp > 0)
    const orderedNearest = [...enemies].sort((a, b) => distance(unit, a) - distance(unit, b))[0]
    const focused = unit.attackTarget ? enemies.find((enemy) => enemy.id === unit.attackTarget) : undefined
    const roleTarget = unit.role === 'stalker' ? enemies.find((enemy) => enemy.role === 'medic') ?? enemies.find((enemy) => enemy.role === 'scout') : undefined
    const nearest = focused ?? roleTarget ?? orderedNearest

    if (unit.team === 'rabbit' && unit.target && distance(unit, unit.target) > 1.2) {
      moveToward(unit, unit.target.x, unit.target.y, unit.role === 'scout' ? 0.65 : 0.48, mission)
      unit.state = 'walk'
      continue
    }
    if (unit.target) unit.target = undefined

    if (unit.role === 'medic') {
      const patient = aliveRabbits.filter((u) => u.hp < u.maxHp && u.id !== unit.id)
        .sort((a, b) => distance(unit, a) - distance(unit, b))[0]
      if (patient && distance(unit, patient) < 12 && unit.cooldown === 0) {
        patient.hp = Math.min(patient.maxHp, patient.hp + 9)
        patient.morale = Math.min(100, patient.morale + 4)
        unit.cooldown = 18
        unit.state = 'attack'
        events.push({ id: eventId++, kind: 'heal', x: patient.x, y: patient.y, createdAt: now })
        continue
      }
    }

    if (!nearest) { unit.state = 'idle'; continue }
    if (unit.role === 'boss' && unit.cooldown === 0) {
      unit.ability = unit.hp > unit.maxHp * .5 ? 'charge' : 'shock'
      unit.telegraph = 12
      unit.state = 'attack'
      events.push({ id: eventId++, kind: 'alert', x: unit.x, y: unit.y, createdAt: now })
      continue
    }
    const shouldAttackObjective = unit.team === 'beast' && context.objective && (context.objective.priority === 'all' || unit.role === 'brute' || unit.role === 'boss')
    if (shouldAttackObjective && context.objective) {
      const objectiveGap = distance(unit, context.objective)
      if (objectiveGap <= 6 && unit.cooldown === 0) {
        objectiveDamage += unit.role === 'brute' ? 7 : unit.role === 'boss' ? 10 : 3
        unit.cooldown = 14
        unit.state = 'attack'
        events.push({ id: eventId++, kind: 'alert', x: context.objective.x, y: context.objective.y, createdAt: now })
        continue
      }
      if (objectiveGap < distance(unit, nearest) * 1.4 || context.objective.priority === 'brute') {
        moveToward(unit, context.objective.x, context.objective.y, unit.role === 'stalker' ? .58 : unit.role === 'brute' || unit.role === 'boss' ? .25 : .36, mission)
        unit.state = 'walk'
        continue
      }
    }
    const range = unit.team === 'rabbit' ? (unit.role === 'scout' ? 23 : 19) : 9
    const gap = distance(unit, nearest)
    if (gap <= range && unit.cooldown === 0) {
      unit.facing = nearest.x >= unit.x ? 1 : -1
      const rawDamage = unit.team === 'rabbit' ? (unit.role === 'scout' ? 17 : 22) : unit.role === 'brute' ? 42 : unit.role === 'boss' ? 48 : 28
      const outgoing = unit.team === 'rabbit' ? context.rabbitDamage ?? 1 : 1
      const armor = nearest.team === 'rabbit' ? context.rabbitArmor ?? 1 : 1
      const damage = Math.round(rawDamage * outgoing * armor * incomingDamageMultiplier(mission, nearest))
      nearest.hp = Math.max(0, nearest.hp - damage)
      nearest.morale = Math.max(0, nearest.morale - 14)
      nearest.state = nearest.hp <= 0 ? 'dead' : 'hurt'
      if (nearest.hp <= 0) nearest.deadSince ??= now
      unit.cooldown = unit.team === 'rabbit' ? 13 : 19
      unit.state = 'attack'
      events.push({ id: eventId++, kind: unit.team === 'rabbit' ? 'shot' : 'blood', x: nearest.x, y: nearest.y, createdAt: now })
    } else if (unit.team === 'beast' && gap > range) {
      const slot = [...unit.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8
      const angle = (slot / 8) * Math.PI * 2
      const slotX = nearest.x + Math.cos(angle) * 7.5
      const slotY = nearest.y + Math.sin(angle) * 5.5
      moveToward(unit, slotX, slotY, unit.role === 'stalker' ? 0.58 : unit.role === 'brute' || unit.role === 'boss' ? 0.25 : 0.36, mission)
      unit.state = 'walk'
    } else if (unit.state !== 'hurt') unit.state = 'idle'
  }

  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < units.length; i++) {
      const a = units[i]
      if (a.hp <= 0) continue
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j]
        const corpseObstacle = b.hp <= 0 && a.team === 'beast'
        if ((!corpseObstacle && (b.hp <= 0 || a.team !== b.team))) continue
        const largeRole = a.role === 'brute' || a.role === 'boss' || b.role === 'brute' || b.role === 'boss'
        const minimum = a.team === 'beast' ? (largeRole ? 14 : 10.5) : 5.5
        let dx = b.x - a.x; let dy = b.y - a.y; let gap = Math.hypot(dx, dy)
        if (gap >= minimum) continue
        if (gap < .01) { dx = i % 2 ? 1 : -1; dy = j % 2 ? 1 : -1; gap = Math.hypot(dx, dy) }
        const push = minimum - gap
        if (corpseObstacle) {
          a.x = clamp(a.x - (dx / gap) * push, 4, 96); a.y = clamp(a.y - (dy / gap) * push, 10, 88)
        } else {
          a.x = clamp(a.x - (dx / gap) * push / 2, 4, 96); a.y = clamp(a.y - (dy / gap) * push / 2, 10, 88)
          b.x = clamp(b.x + (dx / gap) * push / 2, 4, 96); b.y = clamp(b.y + (dy / gap) * push / 2, 10, 88)
        }
      }
    }
  }

  return { units, events, objectiveDamage }
}
