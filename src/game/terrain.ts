import { clamp, distance, type Point, type Team } from './model'

export type TerrainKind = 'open' | 'cover' | 'mud' | 'blood-road'
export interface TerrainZone { kind: Exclude<TerrainKind, 'open'>; x: number; y: number; rx: number; ry: number }
export interface TerrainObstacle { x: number; y: number; r: number; label: string }
export interface BattlefieldTerrain { obstacles: TerrainObstacle[]; zones: TerrainZone[] }

const terrain: Record<number, BattlefieldTerrain> = {
  1: {
    obstacles: [{ x: 15, y: 32, r: 10, label: 'burning chapel' }, { x: 66, y: 28, r: 9, label: 'broken bridge' }, { x: 88, y: 68, r: 8, label: 'river bank' }],
    zones: [{ kind: 'cover', x: 24, y: 58, rx: 13, ry: 12 }, { kind: 'mud', x: 55, y: 52, rx: 13, ry: 16 }, { kind: 'blood-road', x: 43, y: 70, rx: 15, ry: 8 }],
  },
  2: {
    obstacles: [{ x: 22, y: 31, r: 11, label: 'field hospital' }, { x: 47, y: 48, r: 4, label: 'bait convoy' }, { x: 82, y: 27, r: 9, label: 'burning wagons' }],
    zones: [{ kind: 'cover', x: 30, y: 66, rx: 14, ry: 11 }, { kind: 'mud', x: 65, y: 58, rx: 16, ry: 14 }, { kind: 'blood-road', x: 47, y: 74, rx: 18, ry: 7 }],
  },
  3: {
    obstacles: [{ x: 18, y: 24, r: 12, label: 'forest chapel' }, { x: 49, y: 38, r: 8, label: 'grave wall' }, { x: 80, y: 61, r: 10, label: 'collapsed nave' }],
    zones: [{ kind: 'cover', x: 33, y: 62, rx: 13, ry: 12 }, { kind: 'mud', x: 66, y: 42, rx: 14, ry: 15 }, { kind: 'blood-road', x: 54, y: 73, rx: 16, ry: 7 }],
  },
  4: {
    obstacles: [{ x: 23, y: 33, r: 9, label: 'root mound' }, { x: 50, y: 48, r: 4, label: 'extraction engine' }, { x: 81, y: 32, r: 10, label: 'thorn orchard' }],
    zones: [{ kind: 'cover', x: 30, y: 64, rx: 12, ry: 12 }, { kind: 'mud', x: 68, y: 59, rx: 17, ry: 14 }, { kind: 'blood-road', x: 47, y: 76, rx: 18, ry: 7 }],
  },
  5: {
    obstacles: [{ x: 24, y: 28, r: 9, label: 'western burrow' }, { x: 51, y: 37, r: 9, label: 'nursery burrow' }, { x: 79, y: 25, r: 9, label: 'eastern burrow' }],
    zones: [{ kind: 'cover', x: 31, y: 65, rx: 13, ry: 11 }, { kind: 'mud', x: 62, y: 55, rx: 15, ry: 16 }, { kind: 'blood-road', x: 52, y: 75, rx: 18, ry: 7 }],
  },
  6: {
    obstacles: [{ x: 19, y: 31, r: 10, label: 'bone reliquary' }, { x: 55, y: 40, r: 9, label: 'sacrificial trench' }, { x: 82, y: 24, r: 6, label: 'black altar' }],
    zones: [{ kind: 'cover', x: 30, y: 64, rx: 12, ry: 11 }, { kind: 'mud', x: 67, y: 57, rx: 16, ry: 15 }, { kind: 'blood-road', x: 49, y: 75, rx: 19, ry: 7 }],
  },
}

export const terrainForMission = (mission: number): BattlefieldTerrain => terrain[mission] ?? { obstacles: [], zones: [] }

export function obstacleAt(mission: number, point: Point): TerrainObstacle | undefined {
  return terrainForMission(mission).obstacles.find((obstacle) => distance(obstacle, point) < obstacle.r)
}

export function terrainAt(mission: number, point: Point): TerrainKind {
  const zone = terrainForMission(mission).zones.find((candidate) => {
    const dx = (point.x - candidate.x) / candidate.rx
    const dy = (point.y - candidate.y) / candidate.ry
    return dx * dx + dy * dy <= 1
  })
  return zone?.kind ?? 'open'
}

export const movementMultiplier = (mission: number, point: Point, team: Team) => {
  const kind = terrainAt(mission, point)
  if (kind === 'mud') return team === 'beast' ? .78 : .52
  if (kind === 'blood-road') return 1.28
  return 1
}

export const incomingDamageMultiplier = (mission: number, point: Point) => terrainAt(mission, point) === 'cover' ? .62 : 1

export function resolveDestination(mission: number, from: Point, desired: Point): { point: Point; blockedBy?: string } {
  const safe = { x: clamp(desired.x, 4, 96), y: clamp(desired.y, 10, 88) }
  const obstacle = obstacleAt(mission, safe)
  if (!obstacle) return { point: safe }
  const angle = Math.atan2(safe.y - obstacle.y || from.y - obstacle.y, safe.x - obstacle.x || from.x - obstacle.x)
  return {
    point: {
      x: clamp(obstacle.x + Math.cos(angle) * (obstacle.r + 2), 4, 96),
      y: clamp(obstacle.y + Math.sin(angle) * (obstacle.r + 2), 10, 88),
    },
    blockedBy: obstacle.label,
  }
}

export function advanceOnTerrain(mission: number, team: Team, from: Point, desired: Point, speed: number): Point {
  const dx = desired.x - from.x
  const dy = desired.y - from.y
  const len = Math.max(.001, Math.hypot(dx, dy))
  const adjustedSpeed = speed * movementMultiplier(mission, from, team)
  const direct = { x: from.x + (dx / len) * adjustedSpeed, y: from.y + (dy / len) * adjustedSpeed }
  if (!obstacleAt(mission, direct)) return { x: clamp(direct.x, 4, 96), y: clamp(direct.y, 10, 88) }
  const left = { x: from.x + (-dy / len) * adjustedSpeed, y: from.y + (dx / len) * adjustedSpeed }
  if (!obstacleAt(mission, left)) return { x: clamp(left.x, 4, 96), y: clamp(left.y, 10, 88) }
  const right = { x: from.x + (dy / len) * adjustedSpeed, y: from.y + (-dx / len) * adjustedSpeed }
  return obstacleAt(mission, right) ? from : { x: clamp(right.x, 4, 96), y: clamp(right.y, 10, 88) }
}
