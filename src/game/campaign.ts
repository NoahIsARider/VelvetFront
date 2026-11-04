export type Decision = 'mercy' | 'zeal'
import type { Unit } from './model'

export type Ending = 'saint-believed' | 'saint-hollow' | 'heir-army' | 'heir-coup'
export type ContractId = 'no-quarter' | 'red-march' | 'pale-hunt'
export type UpgradeId = 'silver-teeth' | 'stitched-coats' | 'saint-morphine'

export interface CampaignState {
  version: 2
  unlocked: number
  completed: number[]
  choices: Partial<Record<number, Decision>>
  casualties: string[]
  contracts: Partial<Record<ContractId, number>>
  supplies: number
  upgrades: UpgradeId[]
  ending?: Ending
}

export const freshCampaign = (): CampaignState => ({ version: 2, unlocked: 1, completed: [], choices: {}, casualties: [], contracts: {}, supplies: 0, upgrades: [] })

export function parseCampaign(raw: string | null): CampaignState {
  if (!raw) return freshCampaign()
  try {
    const value = JSON.parse(raw) as Omit<Partial<CampaignState>, 'version'> & { version?: number }
    if (value.version !== 1 && value.version !== 2) return freshCampaign()
    return {
      version: 2,
      unlocked: Math.max(1, Math.min(6, Number(value.unlocked) || 1)),
      completed: Array.isArray(value.completed) ? value.completed.filter((id) => Number.isInteger(id) && id >= 1 && id <= 6) : [],
      choices: value.choices && typeof value.choices === 'object' ? value.choices : {},
      casualties: Array.isArray(value.casualties) ? value.casualties.filter((id) => typeof id === 'string') : [],
      contracts: value.contracts && typeof value.contracts === 'object' ? value.contracts : {},
      supplies: Math.max(0, Number(value.supplies) || 0),
      upgrades: Array.isArray(value.upgrades) ? value.upgrades.filter((id): id is UpgradeId => ['silver-teeth','stitched-coats','saint-morphine'].includes(id)) : [],
      ending: ['saint-believed','saint-hollow','heir-army','heir-coup'].includes(value.ending ?? '') ? value.ending : undefined,
    }
  } catch { return freshCampaign() }
}

export function recordContract(state: CampaignState, contract: ContractId, score: number): CampaignState {
  return { ...state, contracts: { ...state.contracts, [contract]: Math.max(state.contracts[contract] ?? 0, Math.round(score)) } }
}

export function recordVictory(state: CampaignState, mission: number, casualties: string[], finalDecision?: Decision): CampaignState {
  const firstClear = !state.completed.includes(mission)
  const completed = [...new Set([...state.completed, mission])].sort((a, b) => a - b)
  return {
    ...state,
    completed,
    unlocked: Math.max(state.unlocked, Math.min(6, mission + 1)),
    casualties: [...new Set([...state.casualties, ...casualties])],
    supplies: state.supplies + (firstClear ? 1 : 0),
    ending: mission === 6 ? resolveEnding(state, finalDecision ?? 'mercy') : state.ending,
  }
}

const upgradeCost: Record<UpgradeId, number> = { 'silver-teeth': 1, 'stitched-coats': 2, 'saint-morphine': 2 }
export const costOfUpgrade = (upgrade: UpgradeId) => upgradeCost[upgrade]
export function purchaseUpgrade(state: CampaignState, upgrade: UpgradeId): CampaignState {
  const cost = costOfUpgrade(upgrade)
  if (state.upgrades.includes(upgrade) || state.supplies < cost) return state
  return { ...state, supplies: state.supplies - cost, upgrades: [...state.upgrades, upgrade] }
}

export const decisionCount = (state: CampaignState, decision: Decision) => Object.values(state.choices).filter((choice) => choice === decision).length

export function resolveEnding(state: CampaignState, finalDecision: Decision): Ending {
  const historyIsMerciful = decisionCount(state, 'mercy') >= decisionCount(state, 'zeal')
  if (finalDecision === 'mercy') return historyIsMerciful ? 'saint-believed' : 'saint-hollow'
  return historyIsMerciful ? 'heir-coup' : 'heir-army'
}

export function applyPermanentRoster(units: Unit[], casualties: string[]): Unit[] {
  const lost = new Set(casualties)
  const survivors = units.filter((unit) => unit.team !== 'rabbit' || !lost.has(unit.id))
  const missing = units.filter((unit) => unit.team === 'rabbit' && lost.has(unit.id))
  return [...survivors, ...missing.map((unit, index): Unit => ({
    ...unit, id: `conscript-${unit.id}`, role: 'rifle', hp: 62, maxHp: 62,
    morale: 58, cooldown: index * 3, selected: false,
  }))]
}
