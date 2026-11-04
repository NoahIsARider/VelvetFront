export interface ObjectiveState {
  collectedBlood: number
  elapsedTicks: number
  occupation: number
  extractorHp: number
  sealedBurrows: number
  bossDead: boolean
  courierAtAltar: boolean
  enemiesAlive: number
}

export const OBJECTIVE_TARGETS = { chapelOccupation: 600, altarRitual: 400 } as const

export const advanceChapelOccupation = (current: number, holding: boolean) => Math.max(0, Math.min(OBJECTIVE_TARGETS.chapelOccupation, current + (holding ? 1 : -2)))
export const advanceAltarRitual = (current: number, ready: boolean) => ready ? Math.min(OBJECTIVE_TARGETS.altarRitual, current + 1) : current

export function isMissionComplete(mission: number, state: ObjectiveState): boolean {
  switch (mission) {
    case 1: return state.collectedBlood >= 4 && state.elapsedTicks >= 600 && state.enemiesAlive === 0
    case 2: return state.elapsedTicks >= 1800 && state.enemiesAlive === 0
    case 3: return state.occupation >= OBJECTIVE_TARGETS.chapelOccupation && state.enemiesAlive === 0
    case 4: return state.elapsedTicks >= 2400 && state.extractorHp > 0 && state.enemiesAlive === 0
    case 5: return state.sealedBurrows >= 3 && state.elapsedTicks >= 900 && state.enemiesAlive === 0
    case 6: return state.bossDead && state.courierAtAltar && state.occupation >= OBJECTIVE_TARGETS.altarRitual && state.enemiesAlive === 0
    default: return false
  }
}

export function withinInteractionRange(actor: { x: number; y: number }, target: { x: number; y: number }, range = 12): boolean {
  return Math.hypot(actor.x - target.x, actor.y - target.y) < range
}
