export type Team = 'rabbit' | 'beast'
export type Role = 'rifle' | 'medic' | 'scout' | 'beast' | 'stalker' | 'brute' | 'boss'
export type UnitState = 'idle' | 'walk' | 'attack' | 'hurt' | 'dead'

export interface Point { x: number; y: number }
export interface Unit {
  id: string
  team: Team
  role: Role
  x: number
  y: number
  hp: number
  maxHp: number
  morale: number
  state: UnitState
  target?: Point
  cooldown: number
  deadSince?: number
  attackTarget?: string
  ability?: 'charge' | 'shock'
  telegraph?: number
  selected?: boolean
  facing: 1 | -1
}

export interface CombatEvent {
  id: number
  kind: 'shot' | 'blood' | 'heal' | 'alert'
  x: number
  y: number
  createdAt: number
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const baseUnits = (): Unit[] => [
  { id: 'r1', team: 'rabbit', role: 'rifle', x: 20, y: 59, hp: 100, maxHp: 100, morale: 90, state: 'idle', cooldown: 0, facing: 1 },
  { id: 'r2', team: 'rabbit', role: 'rifle', x: 25, y: 64, hp: 100, maxHp: 100, morale: 88, state: 'idle', cooldown: 5, facing: 1 },
  { id: 'r3', team: 'rabbit', role: 'scout', x: 18, y: 70, hp: 80, maxHp: 80, morale: 95, state: 'idle', cooldown: 10, facing: 1 },
  { id: 'r4', team: 'rabbit', role: 'medic', x: 27, y: 73, hp: 75, maxHp: 75, morale: 82, state: 'idle', cooldown: 0, facing: 1 },
  { id: 'r5', team: 'rabbit', role: 'rifle', x: 32, y: 67, hp: 100, maxHp: 100, morale: 84, state: 'idle', cooldown: 3, facing: 1 },
  { id: 'b1', team: 'beast', role: 'beast', x: 75, y: 28, hp: 145, maxHp: 145, morale: 100, state: 'idle', cooldown: 0, facing: -1 },
  { id: 'b2', team: 'beast', role: 'beast', x: 84, y: 39, hp: 145, maxHp: 145, morale: 100, state: 'idle', cooldown: 8, facing: -1 },
  { id: 'b3', team: 'beast', role: 'beast', x: 79, y: 57, hp: 165, maxHp: 165, morale: 100, state: 'idle', cooldown: 14, facing: -1 },
  { id: 'b4', team: 'beast', role: 'beast', x: 88, y: 71, hp: 130, maxHp: 130, morale: 100, state: 'idle', cooldown: 4, facing: -1 },
]

export const initialUnits = (mission = 1): Unit[] => {
  const units = baseUnits()
  if (mission >= 2) {
    units.push(
      { id: 'b5', team: 'beast', role: 'stalker', x: 70, y: 44, hp: 105, maxHp: 105, morale: 100, state: 'idle', cooldown: 11, facing: -1 },
      { id: 'b6', team: 'beast', role: 'stalker', x: 91, y: 22, hp: 105, maxHp: 105, morale: 100, state: 'idle', cooldown: 6, facing: -1 },
    )
    const injured = units.find((unit) => unit.id === 'r3')
    if (injured) { injured.hp = 42; injured.morale = 55 }
  }
  if (mission >= 3) {
    units.push(
      { id: 'b7', team: 'beast', role: 'brute', x: 64, y: 24, hp: 240, maxHp: 240, morale: 100, state: 'idle', cooldown: 2, facing: -1 },
      { id: 'b8', team: 'beast', role: 'brute', x: 92, y: 52, hp: 240, maxHp: 240, morale: 100, state: 'idle', cooldown: 16, facing: -1 },
    )
    const lost = units.findIndex((unit) => unit.id === 'r5')
    if (lost >= 0) units.splice(lost, 1)
  }
  if (mission >= 5) {
    units.push({ id: 'b9', team: 'beast', role: 'beast', x: 57, y: 36, hp: 190, maxHp: 190, morale: 100, state: 'idle', cooldown: 9, facing: -1 })
  }
  if (mission >= 6) {
    units.push({ id: 'b10', team: 'beast', role: 'boss', x: 94, y: 63, hp: 420, maxHp: 420, morale: 100, state: 'idle', cooldown: 0, facing: -1 })
  }
  const safeFormations: Record<number, { rabbits: Point[]; beasts: Point[] }> = {
    1: { rabbits: [[20,58],[25,63],[18,69],[28,72],[33,66]].map(([x,y]) => ({x,y})), beasts: [[58,34],[64,43],[60,54],[66,64]].map(([x,y]) => ({x,y})) },
    2: { rabbits: [[24,68],[30,72],[36,76],[42,72],[47,78]].map(([x,y]) => ({x,y})), beasts: [[65,30],[72,35],[78,42],[70,52],[81,57],[61,45]].map(([x,y]) => ({x,y})) },
    3: { rabbits: [[30,72],[36,76],[42,70],[47,77],[52,72]].map(([x,y]) => ({x,y})), beasts: [[62,48],[70,53],[76,61],[67,68],[81,52],[58,60],[73,72],[83,66]].map(([x,y]) => ({x,y})) },
    4: { rabbits: [[24,66],[30,71],[36,75],[42,70],[47,78]].map(([x,y]) => ({x,y})), beasts: [[60,39],[67,44],[74,50],[63,58],[78,62],[56,49],[70,68],[81,55]].map(([x,y]) => ({x,y})) },
    5: { rabbits: [[25,68],[32,73],[39,77],[45,70],[50,78]].map(([x,y]) => ({x,y})), beasts: [[57,32],[65,37],[73,43],[61,51],[78,55],[54,43],[69,61],[81,66],[59,69]].map(([x,y]) => ({x,y})) },
    6: { rabbits: [[24,67],[31,72],[38,77],[44,69],[50,76]].map(([x,y]) => ({x,y})), beasts: [[58,35],[65,40],[72,46],[61,54],[78,57],[55,45],[68,63],[80,68],[58,70],[74,30]].map(([x,y]) => ({x,y})) },
  }
  const formation = safeFormations[mission]
  if (formation) {
    let rabbitIndex = 0
    let beastIndex = 0
    units.forEach((unit) => {
      const position = unit.team === 'rabbit' ? formation.rabbits[rabbitIndex++] : formation.beasts[beastIndex++]
      if (position) { unit.x = position.x; unit.y = position.y }
    })
  }
  return units
}
