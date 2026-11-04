import type { Unit } from './model'

export interface SpriteFrame { row: number; col: number; facingScale: 1 | -1 }

export function resolveRabbitDeathFrame(corpseAge: number): Pick<SpriteFrame, 'row' | 'col'> {
  if (corpseAge < 720) return { row: 0, col: Math.min(3, Math.floor(corpseAge / 180)) }
  if (corpseAge < 6000) return { row: 1, col: 3 }
  if (corpseAge < 12000) return { row: 2, col: 3 }
  return { row: 3, col: 3 }
}

export function resolveSpriteFrame(unit: Unit, animationFrame: number, corpseRow = 0): SpriteFrame {
  if (unit.team === 'beast') {
    const row = unit.role === 'stalker' ? 1 : unit.role === 'brute' ? 2 : unit.role === 'boss' ? 3 : 0
    const col = unit.state === 'dead' ? 3 : unit.state === 'attack' || unit.state === 'hurt' ? 2 : unit.state === 'walk' ? animationFrame % 2 : 0
    // Boar, stalker and brute masters face right. Only the separately generated boss faces left.
    const authoredFacing: 1 | -1 = unit.role === 'boss' ? -1 : 1
    return { row, col, facingScale: unit.facing === authoredFacing ? 1 : -1 }
  }

  const row = unit.state === 'dead' ? corpseRow : unit.state === 'walk' ? 0 : unit.state === 'attack' ? 1 : unit.state === 'hurt' ? 2 : 3
  const col = animationFrame
  return { row, col, facingScale: unit.facing === 1 ? 1 : -1 }
}
