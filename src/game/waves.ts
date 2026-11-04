import type { Role, Unit } from './model'

const schedules: Record<number, number[]> = {
  1: [150, 350, 550], 2: [250, 600, 1000, 1450], 3: [100, 250, 420],
  4: [300, 800, 1400, 2000], 5: [150, 400, 700], 6: [100, 240, 350],
}

const compositions: Record<number, Role[][]> = {
  1: [['beast','beast'], ['stalker','stalker','beast'], ['brute','beast','stalker']],
  2: [['stalker','beast'], ['beast','beast','beast'], ['brute','stalker'], ['brute','brute','beast']],
  3: [['stalker','stalker'], ['brute','beast','beast'], ['brute','stalker','stalker']],
  4: [['beast','beast','stalker'], ['brute','brute'], ['stalker','stalker','stalker'], ['brute','brute','beast','stalker']],
  5: [['stalker','stalker','stalker'], ['brute','beast'], ['brute','brute','stalker']],
  6: [['stalker','stalker'], ['brute','brute','beast'], ['brute','stalker','stalker','beast']],
}

export const waveSchedule = (mission: number) => schedules[mission] ?? []

export function createWave(mission: number, wave: number): Unit[] {
  const roles: Role[] = compositions[mission]?.[wave % compositions[mission].length] ?? ['beast', 'stalker']
  const entryX = mission === 1 ? 68 : mission === 3 ? 76 : 72
  return roles.map((role, index) => {
    const maxHp = role === 'brute' ? 220 : role === 'stalker' ? 100 : 145
    return {
      id: `m${mission}-wave${wave}-${index}`, team: 'beast', role,
      x: entryX - (index % 2) * 6, y: 25 + ((wave * 13 + index * 17) % 50),
      hp: maxHp, maxHp, morale: 100, state: 'idle', cooldown: 4 + index * 5, facing: -1,
    }
  })
}
