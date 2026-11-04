import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { initialUnits, type CombatEvent, type Unit } from './game/model'
import { tickSimulation } from './game/simulation'
import { advanceAltarRitual, advanceChapelOccupation, isMissionComplete, OBJECTIVE_TARGETS, withinInteractionRange } from './game/objectives'
import { resolveRabbitDeathFrame, resolveSpriteFrame } from './game/sprite'
import { applyPermanentRoster, costOfUpgrade, decisionCount, freshCampaign, parseCampaign, purchaseUpgrade, recordContract, recordVictory, resolveEnding, type CampaignState, type ContractId, type Decision, type UpgradeId } from './game/campaign'
import { createWave, waveSchedule } from './game/waves'
import { defaultSettings, parseSettings, type GameSettings } from './game/settings'
import { resolveDestination, terrainAt } from './game/terrain'

type Screen = 'menu' | 'campaign' | 'contracts' | 'armory' | 'archive' | 'settings' | 'story' | 'briefing' | 'playing' | 'victory' | 'defeat'
type Speed = 0 | 1 | 2

const MISSIONS = [
  { id: 1, field: '/assets/battlefield.png', chapter: 'CHAPTER I · SWEETBERRY RIVER', title: 'First Blood Tithe', quote: 'Beauty is proof that Heaven chose us.', objective: 'Invade the river crossing and collect four fresh Moonhorn blood samples.', short: 'Collect four Moonhorn blood samples.', threat: 'LOW', enemies: 4 },
  { id: 2, field: '/assets/battlefield-hospital.png', chapter: 'CHAPTER II · THE FIELD HOSPITAL', title: 'Useful Wounded', quote: 'A casualty is merely an asset that stopped walking.', objective: 'Use the wounded convoy as bait, then cleanse the pursuing herd.', short: 'Defend the wounded bait convoy.', threat: 'HIGH', enemies: 6 },
  { id: 3, field: '/assets/battlefield-chapel.png', chapter: 'CHAPTER III · LAST CHAPEL', title: 'A Beautiful Little Massacre', quote: 'The order is sacred. The bodies are not.', objective: 'Occupy the forest chapel and erase every witness to the false prophecy.', short: 'Occupy the chapel and erase witnesses.', threat: 'EXTREME', enemies: 8 },
  { id: 4, field: '/assets/battlefield-orchard-clear.png', chapter: 'CHAPTER IV · THE WHITE ORCHARD', title: 'Harvest Season', quote: 'The Ministry ordered twelve jars. Bring thirteen.', objective: 'Protect the extraction engine while it drains the sacred grove.', short: 'Protect the blood extraction engine.', threat: 'HIGH', enemies: 8 },
  { id: 5, field: '/assets/battlefield-nursery.png', chapter: 'CHAPTER V · ASH NURSERY', title: 'No Future Witnesses', quote: 'A child remembers longer than a soldier.', objective: 'Seal the nursery burrows before the young Moonhorns can escape.', short: 'Seal all three nursery burrows.', threat: 'SEVERE', enemies: 9 },
  { id: 6, field: '/assets/battlefield-altar.png', chapter: 'CHAPTER VI · THE BLACK ALTAR', title: 'The Lie Made Flesh', quote: 'If the prophecy fails, manufacture a miracle.', objective: 'Deliver the harvested blood to Commander Marrow and kill the Pale Witness.', short: 'Kill the Witness and deliver the blood.', threat: 'FINAL', enemies: 10 },
] as const

const CONTRACTS: { id: ContractId; mission: number; title: string; rule: string; reward: string }[] = [
  { id: 'no-quarter', mission: 2, title: 'No Quarter Given', rule: 'No field medicine. Reinforcements arrive twice. Preserve the bait convoy.', reward: 'BROKEN HALO MEDAL' },
  { id: 'red-march', mission: 4, title: 'The Red March', rule: 'Rabbits deploy wounded. Blood roads are fast but consume morale.', reward: 'CRIMSON ROOT MEDAL' },
  { id: 'pale-hunt', mission: 6, title: 'Hunt the Pale Witness', rule: 'All enemies gain 35% health. The Witness begins enraged.', reward: 'EMPTY SAINT MEDAL' },
]

const UPGRADES: { id: UpgradeId; title: string; effect: string }[] = [
  { id: 'silver-teeth', title: 'Silver Teeth', effect: 'Rifle and scout damage increased by 15%.' },
  { id: 'stitched-coats', title: 'Stitched Coats', effect: 'Rabbits suffer 12% less incoming damage.' },
  { id: 'saint-morphine', title: "Saint's Morphine", effect: 'Deploy with two additional field medicine charges.' },
]

const STORIES = [
  {
    lines: [
      ['CLOVER', 'Command says the bridge is sacred. That usually means someone else has to die on it.', 0],
      ['MALLOW', 'Pip is shaking. The stimulant will stop that. It may also stop his heart.', 1],
      ['PIP', 'They said Moonhorn blood would make Mother beautiful again. I want to believe them.', 2],
      ['ROSARY', 'Belief is cheaper than medicine and survives more funerals.', 3],
      ['CLOVER', 'Then keep him believing until the bridge is ours.', 0],
    ],
    choice: ['Inject Pip and send him first.', 'Send the wounded prisoners first.'],
  },
  {
    lines: [
      ['MALLOW', 'The wounded heard the Moonhorns in the reeds. Good. Fear makes bait sound alive.', 1],
      ['ROSARY', 'Their remaining blood belongs to the Ministry. Waste is a minor heresy.', 3],
      ['CLOVER', 'Then choose whether we drain them now or let the forest do it.', 0],
      ['PIP', 'One of them knows my name. I never told him.', 2],
      ['MALLOW', 'Shock invents intimacy. Put him on the loudest cart.', 1],
    ],
    choice: ['Harvest the wounded for transfusions.', 'Leave them screaming in the reeds.'],
  },
  {
    lines: [
      ['MARROW', 'The chapel contains records proving we began the war. Keep the building. Burn the archive.', 4],
      ['ROSARY', 'The congregation read those records. A beautiful sacrifice can redeem an ugly fact.', 3],
      ['THE PALE WITNESS', 'Your gods have never had to clean the floor.', 5],
      ['PIP', 'The youngest witness is hiding beneath the baptismal basin.', 2],
      ['MARROW', 'Then the basin is evidence. Burn both.', 4],
    ],
    choice: ['Lock the congregation inside and burn it.', 'Shoot them outside to preserve the chapel.'],
  },
  {
    lines: [
      ['MARROW', 'The orchard grows memory in its roots. Our machines will make it forget.', 4],
      ['MALLOW', 'The extraction pipes are full of children’s teeth.', 1],
      ['CLOVER', 'Then stop looking inside the pipes.', 0],
      ['ROSARY', 'The trees scream in memories stolen from our own wounded.', 3],
      ['MARROW', 'Excellent. Bottle the screams separately; morale wants familiar voices.', 4],
    ],
    choice: ['Overdrive the extractor.', 'Feed prisoners into the stalled pump.'],
  },
  {
    lines: [
      ['PIP', 'The nursery is singing. They sound like us before boot camp.', 2],
      ['ROSARY', 'That resemblance is the enemy’s oldest weapon.', 3],
      ['CLOVER', 'Seal the eastern burrow. Leave one tunnel open so they gather there.', 0],
      ['MALLOW', 'Sedative dosage for the young?', 1],
      ['ROSARY', 'None. The Ministry wants the recording to sound authentic.', 3],
    ],
    choice: ['Flood the open tunnel with fire.', 'Collapse it after they enter.'],
  },
  {
    lines: [
      ['MARROW', 'There was never a beauty miracle. But there will be, once the cameras arrive.', 4],
      ['THE PALE WITNESS', 'You killed a forest to improve your reflection.', 5],
      ['CLOVER', 'No. We killed it because admitting the truth costs more.', 0],
      ['PIP', 'Mother died in year three. I remembered before the cameras did.', 2],
      ['MARROW', 'Then smile for her. Grief is the last resource we have not nationalized.', 4],
    ],
    choice: ['Drink the blood and perform the miracle.', 'Kill Marrow and inherit the lie.'],
  },
] as const

function TitleBar() {
  return <div className="titlebar">
    <div className="titlebar-brand"><span className="brand-mark" />VELVET FRONT</div>
    <div className="window-actions">
      <button onClick={() => window.desktop?.minimize()} aria-label="Minimize">—</button>
      <button onClick={() => window.desktop?.toggleMaximize()} aria-label="Maximize">□</button>
      <button onClick={() => window.desktop?.close()} aria-label="Close">×</button>
    </div>
  </div>
}

function Sprite({ unit, frame }: { unit: Unit; frame: number }) {
  const corpseAge = unit.deadSince ? Date.now() - unit.deadSince : 0
  const deathFrame = resolveRabbitDeathFrame(corpseAge)
  const sprite = resolveSpriteFrame(unit, unit.team === 'rabbit' && unit.state === 'dead' ? deathFrame.col : frame, deathFrame.row)
  const source = unit.team === 'rabbit'
    ? unit.state === 'dead'
      ? `/assets/sprites/gore/gore-r${sprite.row}-c${sprite.col}.png`
      : `/assets/sprites/rabbit/rabbit-r${sprite.row}-c${sprite.col}.png`
    : unit.role === 'boss'
      ? `/assets/sprites/boss/boss-c${sprite.col}.png`
      : `/assets/sprites/enemy/enemy-r${sprite.row}-c${sprite.col}.png`
  const style = {
    left: `${unit.x}%`, top: `${unit.y}%`,
    '--face': sprite.facingScale,
  } as React.CSSProperties
  return <button className={`unit ${unit.team} ${unit.role} ${unit.state} ${unit.selected ? 'selected' : ''}`}
    style={style} data-id={unit.id} aria-label={`${unit.role} ${unit.hp}`} disabled={unit.hp <= 0}>
    {unit.hp > 0 && <img className="ground-contact" src="/assets/ground-contact.png" alt="" draggable={false} />}
    <img className="unit-art" src={source} alt="" draggable={false} />
    {unit.role === 'boss' && !!unit.telegraph && <span className={`boss-telegraph ${unit.ability ?? ''}`} />}
    {unit.selected && <span className="selection-ring effect-cell effect-8" />}
    <span className="health"><i style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} /></span>
  </button>
}

function Effect({ event }: { event: CombatEvent }) {
  return <img className={`combat-effect combat-${event.kind}`} src={`/assets/vfx-${event.kind}.png`} alt="" style={{ left: `${event.x}%`, top: `${event.y}%` }} />
}

function ObjectiveProp({ index, x, y, label, onClick, sealed = false }: { index: number; x: number; y: number; label: string; onClick?: () => void; sealed?: boolean }) {
  const col = index % 3
  const row = Math.floor(index / 3)
  const style = { left: `${x}%`, top: `${y}%`, '--ox': `${col * 50}%`, '--oy': `${row * 100}%` } as React.CSSProperties
  return <button className={`objective-prop ${sealed ? 'sealed' : ''}`} style={style} onClick={(event) => { event.stopPropagation(); onClick?.() }} aria-label={label}><span /></button>
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mission, setMission] = useState(1)
  const [storyIndex, setStoryIndex] = useState(0)
  const [doctrine, setDoctrine] = useState<'mercy' | 'zeal'>('mercy')
  const [units, setUnits] = useState<Unit[]>(() => initialUnits(1))
  const [events, setEvents] = useState<CombatEvent[]>([])
  const [speed, setSpeed] = useState<Speed>(1)
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState('Select a rabbit, then click the battlefield to move.')
  const [objectiveProgress, setObjectiveProgress] = useState(0)
  const [collected, setCollected] = useState<string[]>([])
  const [sealedBurrows, setSealedBurrows] = useState<number[]>([])
  const [extractorHp, setExtractorHp] = useState(100)
  const [convoyHp, setConvoyHp] = useState(100)
  const [focusMode, setFocusMode] = useState(false)
  const [medicalCharges, setMedicalCharges] = useState(2)
  const [activeContract, setActiveContract] = useState<ContractId | null>(null)
  const [campaign, setCampaign] = useState<CampaignState>(() => typeof localStorage === 'undefined' ? freshCampaign() : parseCampaign(localStorage.getItem('velvet-front-campaign')))
  const [settings, setSettings] = useState<GameSettings>(() => typeof localStorage === 'undefined' ? defaultSettings() : parseSettings(localStorage.getItem('velvet-front-settings')))
  const fieldRef = useRef<HTMLDivElement>(null)
  const recordedVictory = useRef(0)
  const spawnedWaves = useRef(new Set<number>())
  const lastSfxAt = useRef(0)
  const frame = Math.floor(tick / 2) % 4

  const selected = units.filter((unit) => unit.selected && unit.hp > 0)
  const rabbitsAlive = units.filter((unit) => unit.team === 'rabbit' && unit.hp > 0).length
  const beastsAlive = units.filter((unit) => unit.team === 'beast' && unit.hp > 0).length
  const morale = useMemo(() => {
    const living = units.filter((u) => u.team === 'rabbit' && u.hp > 0)
    return living.length ? Math.round(living.reduce((sum, u) => sum + u.morale, 0) / living.length) : 0
  }, [units])
  const missionData = MISSIONS[mission - 1]
  const casualtyCount = units.filter((unit) => unit.team === 'rabbit' && unit.hp <= 0).length
  const mercyLegacy = decisionCount(campaign, 'mercy')
  const zealLegacy = decisionCount(campaign, 'zeal')
  const ending = resolveEnding(campaign, doctrine)
  const endingCopy = {
    'saint-believed': ['The saint smiles for the cameras.', 'Your practiced mercy makes the counterfeit miracle believable. Children drink poison in your name.'],
    'saint-hollow': ['The studio lights expose every scar.', 'After five chapters of zeal, no one believes your sudden sainthood. Marrow broadcasts your execution instead.'],
    'heir-army': ["Marrow is dead. His chair is warm.", 'The officers recognize the cruelty that trained them. By sunrise, the army answers to you.'],
    'heir-coup': ['The gentle conspirators close the door.', 'Your earlier restraint taught survivors to organize. They let you kill Marrow, then quietly remove you too.'],
  }[ending]

  useEffect(() => { localStorage.setItem('velvet-front-campaign', JSON.stringify(campaign)) }, [campaign])
  useEffect(() => { localStorage.setItem('velvet-front-settings', JSON.stringify(settings)) }, [settings])

  useEffect(() => {
    if (screen !== 'playing' || settings.music <= 0 || settings.master <= 0) return
    const volume = (settings.master / 100) * (settings.music / 100)
    const music = new Audio('/assets/audio/music.wav'); const ambience = new Audio('/assets/audio/ambience.wav')
    music.loop = true; ambience.loop = true; music.volume = volume * .5; ambience.volume = volume * .35
    void music.play().catch(() => undefined); void ambience.play().catch(() => undefined)
    return () => { music.pause(); ambience.pause() }
  }, [screen, settings.master, settings.music])

  useEffect(() => {
    if (screen !== 'victory' || recordedVictory.current === mission) return
    recordedVictory.current = mission
    const lost = units.filter((unit) => unit.team === 'rabbit' && unit.hp <= 0).map((unit) => unit.id)
    const score = Math.max(0, rabbitsAlive * 1000 + morale * 20 + medicalCharges * 250 - Math.floor(tick / 10))
    setCampaign((state) => activeContract
      ? recordContract(state, activeContract, score)
      : recordVictory(state, mission, lost, mission === 6 ? doctrine : undefined))
  }, [activeContract, doctrine, medicalCharges, mission, morale, rabbitsAlive, screen, tick, units])

  useEffect(() => {
    if (screen !== 'playing' || speed === 0) return
    const timer = window.setInterval(() => {
      setUnits((current) => {
        const objective = mission === 2 ? { x: 47, y: 48, priority: 'all' as const } : mission === 4 ? { x: 50, y: 48, priority: 'brute' as const } : undefined
        const result = tickSimulation(current, Date.now(), {
          objective, mission,
          rabbitDamage: campaign.upgrades.includes('silver-teeth') ? 1.15 : 1,
          rabbitArmor: campaign.upgrades.includes('stitched-coats') ? .88 : 1,
        })
        const died = result.units.some((unit) => unit.hp <= 0 && (current.find((old) => old.id === unit.id)?.hp ?? 0) > 0)
        if (result.events.length && Date.now() - lastSfxAt.current > 90) {
          lastSfxAt.current = Date.now()
          const kind = died ? 'death' : result.events[0].kind === 'shot' ? 'rifle' : result.events[0].kind === 'heal' ? 'heal' : result.events[0].kind === 'alert' ? 'boss' : 'impact'
          playSfx(kind)
        }
        if (result.objectiveDamage) {
          if (mission === 2) setConvoyHp((value) => Math.max(0, value - result.objectiveDamage))
          if (mission === 4) setExtractorHp((value) => Math.max(0, value - result.objectiveDamage))
        }
        setEvents((old) => {
          const current = [...old.filter((event) => Date.now() - event.createdAt < 1100), ...result.events]
          const unique = new Map(current.map((event) => [`${event.id}-${event.kind}-${event.x}-${event.y}`, event]))
          return [...unique.values()]
        })
        return result.units
      })
      setTick((value) => value + speed)
    }, speed === 2 ? 65 : 115)
    return () => window.clearInterval(timer)
  }, [campaign.upgrades, mission, screen, settings.master, settings.sfx, speed])

  useEffect(() => {
    if (screen !== 'victory' && screen !== 'defeat') return
    const timer = window.setInterval(() => setTick((value) => value + 1), 300)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'playing') return
    if (rabbitsAlive === 0 || morale === 0) setScreen('defeat')
    if (mission === 2 && convoyHp <= 0) setScreen('defeat')
    const bossDead = units.some((unit) => unit.id === 'b10' && unit.hp <= 0)
    const courierAtAltar = units.some((unit) => unit.team === 'rabbit' && unit.hp > 0 && Math.hypot(unit.x - 82, unit.y - 24) < 11)
    const complete = (occupation = objectiveProgress) => isMissionComplete(mission, { collectedBlood: collected.length, elapsedTicks: tick, occupation, extractorHp, sealedBurrows: sealedBurrows.length, bossDead, courierAtAltar, enemiesAlive: beastsAlive })
    if ((mission === 1 || mission === 2 || mission === 5) && complete()) setScreen('victory')
    if (mission === 3) {
      const holding = units.filter((unit) => unit.team === 'rabbit' && unit.hp > 0 && unit.x < 30 && unit.y < 38).length >= 2
      const next = advanceChapelOccupation(objectiveProgress, holding)
      if (next !== objectiveProgress) setObjectiveProgress(next)
      if (complete(next)) setScreen('victory')
    }
    if (mission === 4) {
      if (extractorHp <= 0) setScreen('defeat')
      if (complete()) setScreen('victory')
    }
    if (mission === 6) {
      const next = advanceAltarRitual(objectiveProgress, bossDead && courierAtAltar)
      if (next !== objectiveProgress) setObjectiveProgress(next)
      if (complete(next)) setScreen('victory')
    }
  }, [beastsAlive, collected.length, convoyHp, mission, morale, rabbitsAlive, screen, sealedBurrows.length, tick, units])

  useEffect(() => {
    if (screen !== 'playing') return
    const baseSchedule = waveSchedule(mission)
    const schedule = activeContract ? baseSchedule.flatMap((threshold) => [threshold, threshold + 220]) : baseSchedule
    schedule.forEach((threshold, wave) => {
      if (tick < threshold || spawnedWaves.current.has(wave)) return
      spawnedWaves.current.add(wave)
      setUnits((current) => [...current, ...createWave(mission, wave)])
      setToast(`COUNTERATTACK ${wave + 1}: new Moonhorn signatures entering the field.`)
    })
  }, [activeContract, mission, screen, tick])

  const startMission = (id: number, contract: ContractId | null = null) => {
    if (id > campaign.unlocked) { setToast(`Chapter ${id} is locked. Complete the previous atrocity first.`); return }
    setActiveContract(contract)
    setMission(id)
    recordedVictory.current = 0
    spawnedWaves.current = new Set()
    setUnits(applyPermanentRoster(initialUnits(id), campaign.casualties).map((unit) => {
      if (unit.team !== 'rabbit') {
        const contractScale = contract === 'pale-hunt' ? 1.35 : contract ? 1.18 : 1
        const hp = Math.round((unit.hp + zealLegacy * 7) * contractScale)
        return { ...unit, hp, maxHp: hp, cooldown: contract === 'pale-hunt' && unit.role === 'boss' ? 0 : unit.cooldown }
      }
      const woundedScale = contract === 'red-march' ? .68 : 1
      return { ...unit, hp: Math.max(1, Math.round(Math.min(unit.maxHp, unit.hp + mercyLegacy * 4) * woundedScale)), morale: Math.min(100, unit.morale + zealLegacy * 3) }
    }))
    setEvents([])
    setTick(0)
    setSpeed(1)
    setObjectiveProgress(0)
    setCollected([])
    setSealedBurrows([])
    setExtractorHp(100)
    setConvoyHp(100)
    setFocusMode(false)
    setMedicalCharges(contract === 'no-quarter' ? 0 : 2 + Math.min(3, mercyLegacy) + (campaign.upgrades.includes('saint-morphine') ? 2 : 0))
    setStoryIndex(0)
    setScreen(contract ? 'briefing' : 'story')
  }

  const resolveStoryChoice = (choice: Decision) => {
    setDoctrine(choice)
    setCampaign((state) => ({ ...state, choices: { ...state.choices, [mission]: choice } }))
    setUnits((current) => current.map((unit) => unit.team !== 'rabbit' ? unit : choice === 'mercy'
      ? { ...unit, hp: Math.min(unit.maxHp, unit.hp + 15), morale: Math.min(100, unit.morale + 4) }
      : { ...unit, hp: Math.max(1, unit.hp - 8), morale: Math.min(100, unit.morale + 14) }))
    setScreen('briefing')
  }

  const selectUnit = (id: string, additive: boolean) => {
    setUnits((current) => current.map((unit) => ({
      ...unit,
      selected: unit.team === 'rabbit' && unit.hp > 0 && (additive ? (unit.id === id ? !unit.selected : unit.selected) : unit.id === id),
    })))
  }

  const issueMove = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.unit') || !selected.length || !fieldRef.current) return
    const rect = fieldRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    const routed = resolveDestination(mission, selected[0], { x, y })
    setUnits((current) => current.map((unit, index) => unit.selected ? {
      ...unit, target: { x: routed.point.x + (index % 3) * 2, y: routed.point.y + Math.floor(index / 3) * 2 }, state: 'walk',
    } : unit))
    const terrain = terrainAt(mission, routed.point)
    setToast(routed.blockedBy
      ? `Route adjusted around ${routed.blockedBy.toUpperCase()}.`
      : terrain === 'cover' ? 'Moving into cover: incoming damage reduced.'
      : terrain === 'mud' ? 'Mud route: rabbits will move slowly.'
      : terrain === 'blood-road' ? 'Blood road: faster movement, continuous morale loss.'
      : `Squad moving to grid ${Math.round(x)} · ${Math.round(y)}.`)
  }

  const sealBurrow = (index: number, x: number, y: number) => {
    const closeEnough = selected.some((unit) => withinInteractionRange(unit, { x, y }, 13))
    if (!closeEnough) { setToast('Move a selected rabbit next to the burrow before sealing it.'); return }
    setSealedBurrows((current) => current.includes(index) ? current : [...current, index])
    setToast(`Burrow ${index + 1} sealed. The young are trapped inside.`)
  }

  const collectBlood = (id: string, x: number, y: number) => {
    const closeEnough = selected.some((unit) => withinInteractionRange(unit, { x, y }))
    if (!closeEnough) { setToast('Move a selected rabbit next to the blood jar before collecting it.'); return }
    setCollected((old) => old.includes(id) ? old : [...old, id])
    setToast('Fresh blood secured for the Ministry.')
  }

  const playSfx = (name: 'ui' | 'heal' | 'rifle' | 'impact' | 'death' | 'boss' = 'ui') => {
    if (settings.master <= 0 || settings.sfx <= 0) return
    const audio = new Audio(`/assets/audio/${name}.wav`)
    audio.volume = (settings.master / 100) * (settings.sfx / 100)
    void audio.play().catch(() => undefined)
  }

  useEffect(() => {
    const onClick = (event: Event) => { if ((event.target as HTMLElement).closest('button')) playSfx('ui') }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [settings.master, settings.sfx])

  const useMedicine = () => {
    if (!selected.length || medicalCharges <= 0) { setToast('Select a wounded rabbit. No treatment is available without a charge.'); return }
    setUnits((current) => current.map((unit) => unit.selected ? { ...unit, hp: Math.min(unit.maxHp, unit.hp + 32), morale: Math.min(100, unit.morale + 8) } : unit))
    setMedicalCharges((value) => value - 1)
    setToast('Emergency treatment administered. One medical charge consumed.')
    playSfx('heal')
  }

  const interactObjective = () => {
    if (!selected.length) { setToast('Select a rabbit before interacting.'); return }
    if (mission === 1) {
      const jar = units.filter((unit) => unit.team === 'beast' && unit.hp <= 0 && !collected.includes(unit.id))
        .sort((a, b) => Math.min(...selected.map((unit) => Math.hypot(unit.x - a.x, unit.y - a.y))) - Math.min(...selected.map((unit) => Math.hypot(unit.x - b.x, unit.y - b.y))))[0]
      if (jar) { collectBlood(jar.id, jar.x, jar.y); playSfx('ui'); return }
    }
    if (mission === 5) {
      const nearest = [[0,24,28],[1,51,37],[2,79,25]].filter(([index]) => !sealedBurrows.includes(index))
        .sort((a, b) => Math.min(...selected.map((unit) => Math.hypot(unit.x - a[1], unit.y - a[2]))) - Math.min(...selected.map((unit) => Math.hypot(unit.x - b[1], unit.y - b[2]))))[0]
      if (nearest) { sealBurrow(nearest[0], nearest[1], nearest[2]); playSfx('impact'); return }
    }
    setToast('No usable objective is within reach.')
  }

  useEffect(() => {
    if (screen !== 'playing') return
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') { event.preventDefault(); setSpeed((value) => value === 0 ? 1 : 0); return }
      const slot = /^Digit([1-5])$/.exec(event.code)
      if (slot) { const rabbit = units.filter((unit) => unit.team === 'rabbit')[Number(slot[1]) - 1]; if (rabbit) selectUnit(rabbit.id, false); return }
      if (event.code === 'KeyH') { useMedicine(); return }
      if (event.code === 'KeyE') { interactObjective(); return }
      if (event.code === 'KeyR') { setUnits((all) => all.map((unit) => unit.selected ? { ...unit, target: { x: 12, y: 78 } } : unit)); return }
      if (event.code === 'KeyF') {
        const enemy = units.filter((unit) => unit.team === 'beast' && unit.hp > 0).sort((a,b) => a.x - b.x)[0]
        if (enemy) setUnits((all) => all.map((unit) => unit.selected ? { ...unit, attackTarget: enemy.id } : unit))
        return
      }
      const delta = event.code === 'ArrowLeft' ? [-5,0] : event.code === 'ArrowRight' ? [5,0] : event.code === 'ArrowUp' ? [0,-5] : event.code === 'ArrowDown' ? [0,5] : undefined
      if (delta) { event.preventDefault(); setUnits((all) => all.map((unit) => unit.selected ? { ...unit, target: { x: unit.x + delta[0], y: unit.y + delta[1] } } : unit)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, units, medicalCharges])

  useEffect(() => {
    if (screen === 'playing') return
    let focused = 0
    let previous = ''
    const focusControl = (offset = 0) => {
      const controls = [...document.querySelectorAll<HTMLElement>('button:not(:disabled), input[type="range"]')].filter((control) => control.offsetParent !== null)
      if (!controls.length) return
      focused = (focused + offset + controls.length) % controls.length
      controls[focused].focus()
    }
    window.setTimeout(() => focusControl(), 0)
    const timer = window.setInterval(() => {
      const pad = navigator.getGamepads?.()[0]
      if (!pad) return
      const pressed = pad.buttons.map((button, index) => button.pressed ? index : -1).filter((index) => index >= 0).join(',')
      if (pressed === previous) return
      previous = pressed
      if (pad.buttons[12]?.pressed) focusControl(-1)
      if (pad.buttons[13]?.pressed) focusControl(1)
      if (pad.buttons[14]?.pressed || pad.buttons[15]?.pressed) {
        if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'range') {
          const direction = pad.buttons[14]?.pressed ? -1 : 1
          document.activeElement.value = String(Math.max(Number(document.activeElement.min), Math.min(Number(document.activeElement.max), Number(document.activeElement.value) + direction * Number(document.activeElement.step || 1))))
          document.activeElement.dispatchEvent(new Event('input', { bubbles: true }))
        } else focusControl(pad.buttons[14]?.pressed ? -1 : 1)
      }
      if (pad.buttons[0]?.pressed && document.activeElement instanceof HTMLButtonElement) document.activeElement.click()
      if (pad.buttons[1]?.pressed) [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => /RETURN|CHANGE ASSIGNMENT|OPERATIONS MAP|APPLY & RETURN/.test(button.textContent ?? ''))?.click()
    }, 120)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'playing' || !navigator.getGamepads) return
    let previous = ''
    const timer = window.setInterval(() => {
      const pad = navigator.getGamepads()[0]
      if (!pad) return
      const pressed = pad.buttons.map((button, index) => button.pressed ? index : -1).filter((index) => index >= 0).join(',')
      if (pressed === previous) return
      previous = pressed
      if (pad.buttons[9]?.pressed) setSpeed((value) => value === 0 ? 1 : 0)
      if (pad.buttons[2]?.pressed) useMedicine()
      if (pad.buttons[1]?.pressed) setUnits((all) => all.map((unit) => unit.selected ? { ...unit, target: { x: 12, y: 78 } } : unit))
      if (pad.buttons[0]?.pressed) interactObjective()
      if (pad.buttons[4]?.pressed) {
        const rabbits = units.filter((unit) => unit.team === 'rabbit' && unit.hp > 0)
        const current = rabbits.findIndex((unit) => unit.selected)
        const next = rabbits[(current + 1) % Math.max(1, rabbits.length)]
        if (next) selectUnit(next.id, false)
      }
      if (pad.buttons[5]?.pressed) {
        const enemy = units.filter((unit) => unit.team === 'beast' && unit.hp > 0).sort((a, b) => a.x - b.x)[0]
        if (enemy) setUnits((all) => all.map((unit) => unit.selected ? { ...unit, attackTarget: enemy.id } : unit))
      }
      const dx = pad.buttons[14]?.pressed ? -5 : pad.buttons[15]?.pressed ? 5 : 0
      const dy = pad.buttons[12]?.pressed ? -5 : pad.buttons[13]?.pressed ? 5 : 0
      if (dx || dy) setUnits((all) => all.map((unit) => unit.selected ? { ...unit, target: { x: unit.x + dx, y: unit.y + dy } } : unit))
    }, 120)
    return () => window.clearInterval(timer)
  }, [screen, units, medicalCharges])

  const objectiveStatus = mission === 1 ? `BLOOD JARS ${collected.length} / 4`
    : mission === 2 ? `BAIT ${Math.round(convoyHp)}% · TIME ${Math.min(100, Math.round(tick / 18))}%`
    : mission === 3 ? `OCCUPATION ${Math.round((objectiveProgress / OBJECTIVE_TARGETS.chapelOccupation) * 100)}%`
    : mission === 4 ? `EXTRACTOR ${Math.round(extractorHp)}%`
    : mission === 5 ? `BURROWS SEALED ${sealedBurrows.length} / 3`
    : `RITUAL DELIVERY ${Math.round((objectiveProgress / OBJECTIVE_TARGETS.altarRitual) * 100)}%`
  const selectedTerrain = selected.length ? terrainAt(mission, selected[0]) : 'open'

  return <div className={`app-shell ${settings.reducedMotion ? 'reduced-motion' : ''} ${settings.highContrast ? 'high-contrast' : ''}`} style={{ '--text-scale': settings.textScale } as React.CSSProperties}>
    <TitleBar />
    <main className="stage">
      <img className="stage-background" src={missionData.field} alt={`${missionData.title} battlefield`} draggable={false} />
      <div className="stage-vignette" />

      {screen === 'menu' && <img className="title-hero" src="/assets/title-rabbit-duo.png" alt="Clover and Rosary after the campaign" />}
      {screen === 'menu' && <section className="menu-screen">
        <div className="eyebrow">A HAND-DRAWN ANTI-WAR TACTICS GAME</div>
        <h1><span>VELVET</span>FRONT</h1>
        <p className="subtitle">The forest remembers no victors. Only who bled.</p>
        <button className="primary" onClick={() => setScreen('campaign')}>BEGIN CAMPAIGN</button>
        <button className="secondary" onClick={() => setScreen('archive')}>FIELD ARCHIVE</button>
        <button className="secondary" onClick={() => setScreen('settings')}>OPTIONS & ACCESSIBILITY</button>
        <div className="content-note">FANTASY VIOLENCE, GORE AND BODY HORROR · MATURE PLAYERS</div>
      </section>}

      {screen === 'campaign' && <section className="campaign-screen ui-card">
        <div className="screen-heading"><span>THE RABBIT DOMINION · INVASION YEAR 9</span><h2>Choose an atrocity.</h2><p>The Ministry calls it a holy war. The invoices call it resource acquisition.</p></div>
        <div className="mission-list">{MISSIONS.map((item) => <button key={item.id} disabled={item.id > campaign.unlocked} className={campaign.completed.includes(item.id) ? 'completed' : ''} onClick={() => startMission(item.id)}>
          <img className="mission-thumb" src={item.field} alt="" /><i>0{item.id}</i><div><small>{item.chapter}</small><strong>{item.id > campaign.unlocked ? 'CLASSIFIED' : item.title}</strong><span>{item.id > campaign.unlocked ? 'Complete the previous operation.' : item.short}</span></div><b className={`threat threat-${item.id}`}>{campaign.completed.includes(item.id) ? 'CLEARED' : item.id > campaign.unlocked ? 'LOCKED' : item.threat}</b>
        </button>)}</div>
        <div className="campaign-ledger">
          <div><small>WAR PATH</small><strong>{campaign.completed.length} / 6 CLEARED</strong><span>Next order: Chapter {Math.min(6, campaign.unlocked)}</span></div>
          <div><small>PERMANENT COST</small><strong>{campaign.casualties.length} CASUALTIES</strong><span>{campaign.casualties.length ? campaign.casualties.join(' · ') : 'The roster is intact—for now.'}</span></div>
          <div><small>MORAL RECORD</small><strong>{mercyLegacy} MERCY · {zealLegacy} ZEAL</strong><span>{mercyLegacy >= zealLegacy ? 'The Ministry calls restraint useful.' : 'The Ministry rewards obedience.'}</span></div>
        </div>
        <div className="campaign-actions"><button className="text-back" onClick={() => setScreen('menu')}>← RETURN TO TITLE</button><button className="text-back contract-link" onClick={() => setScreen('armory')}>QUARTERMASTER · {campaign.supplies}</button><button className="text-back contract-link" onClick={() => setScreen('contracts')}>WAR CONTRACTS →</button></div>
      </section>}

      {screen === 'contracts' && <section className="contracts-screen ui-card">
        <div className="screen-heading"><span>MINISTRY BLACK ORDERS · REPLAY OPERATIONS</span><h2>Earn medals nobody should want.</h2><p>Each contract changes the rules, doubles counterattacks and records your best score.</p></div>
        <div className="contract-grid">{CONTRACTS.map((contract, index) => {
          const available = campaign.unlocked >= contract.mission
          const best = campaign.contracts[contract.id]
          return <article key={contract.id} className={!available ? 'locked' : ''}>
            <small>CONTRACT 0{index + 1} · CHAPTER {contract.mission}</small><img className="card-art" src={`/assets/contract-${contract.id}.png`} alt="" /><h3>{available ? contract.title : 'SEALED ORDER'}</h3>
            <p>{available ? contract.rule : `Unlock Chapter ${contract.mission} to reveal this order.`}</p>
            <strong>{best ? `BEST SCORE ${best}` : contract.reward}</strong>
            <button className="primary" disabled={!available} onClick={() => startMission(contract.mission, contract.id)}>{best ? 'REDEPLOY' : 'ACCEPT CONTRACT'}</button>
          </article>
        })}</div>
        <button className="text-back" onClick={() => setScreen('campaign')}>← OPERATIONS MAP</button>
      </section>}

      {screen === 'armory' && <section className="contracts-screen armory-screen ui-card">
        <div className="screen-heading"><span>QUARTERMASTER · {campaign.supplies} REQUISITION AVAILABLE</span><h2>Improve the rabbits. Not the cause.</h2><p>First-time chapter clears earn one requisition. Purchases permanently alter every operation.</p></div>
        <div className="contract-grid">{UPGRADES.map((upgrade, index) => {
          const owned = campaign.upgrades.includes(upgrade.id)
          const cost = costOfUpgrade(upgrade.id)
          return <article key={upgrade.id}>
            <small>REQUISITION 0{index + 1} · COST {cost}</small><img className="card-art" src={`/assets/upgrade-${upgrade.id}.png`} alt="" /><h3>{upgrade.title}</h3><p>{upgrade.effect}</p>
            <strong>{owned ? 'ISSUED TO ALL SURVIVORS' : `${campaign.supplies} SUPPLIES IN STORES`}</strong>
            <button className="primary" disabled={owned || campaign.supplies < cost} onClick={() => setCampaign((state) => purchaseUpgrade(state, upgrade.id))}>{owned ? 'EQUIPPED' : campaign.supplies < cost ? 'INSUFFICIENT SUPPLIES' : 'REQUISITION'}</button>
          </article>
        })}</div>
        <button className="text-back" onClick={() => setScreen('campaign')}>← OPERATIONS MAP</button>
      </section>}

      {screen === 'archive' && <section className="archive-screen ui-card">
        <div className="screen-heading"><span>FIELD ARCHIVE · 03 ENTRIES</span><h2>Know what will die.</h2></div>
        <div className="archive-grid">
          <article><span className="archive-sprite rabbit-rifle" /><small>BLUECAP RIFLEMAN</small><h3>Line Infantry</h3><p>Reliable fire at medium range. Their courage lasts longer when they stand together.</p></article>
          <article><span className="archive-sprite rabbit-medic" /><small>FIELD MEDIC</small><h3>Mercy Unit</h3><p>Restores health and morale. The red cross makes no promise of safety.</p></article>
          <article><span className="archive-sprite beast-entry" /><small>MOONHORN</small><h3>Forest Predator</h3><p>A charging silhouette of tooth, fur and crescent bone. It does not retreat.</p></article>
        </div>
        <button className="text-back" onClick={() => setScreen('menu')}>← RETURN TO TITLE</button>
      </section>}

      {screen === 'settings' && <section className="settings-screen ui-card">
        <div className="screen-heading"><span>PLAYER OPTIONS · SAVED AUTOMATICALLY</span><h2>Make the war readable.</h2><p>All commands remain available to mouse, keyboard and controller players.</p></div>
        <div className="settings-grid">
          {([['master','MASTER VOLUME'],['music','MUSIC VOLUME'],['sfx','SFX VOLUME']] as const).map(([key,label]) => <label key={key}><span>{label}</span><input type="range" min="0" max="100" value={settings[key]} onChange={(event) => setSettings((old) => ({ ...old, [key]: Number(event.target.value) }))} /><b>{settings[key]}%</b></label>)}
          <label><span>TEXT SCALE</span><input type="range" min="0.85" max="1.3" step="0.05" value={settings.textScale} onChange={(event) => setSettings((old) => ({ ...old, textScale: Number(event.target.value) }))} /><b>{Math.round(settings.textScale * 100)}%</b></label>
          <button className="secondary" onClick={() => setSettings((old) => ({ ...old, reducedMotion: !old.reducedMotion }))}>REDUCED MOTION · {settings.reducedMotion ? 'ON' : 'OFF'}</button>
          <button className="secondary" onClick={() => setSettings((old) => ({ ...old, highContrast: !old.highContrast }))}>HIGH CONTRAST · {settings.highContrast ? 'ON' : 'OFF'}</button>
          <button className="secondary" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>TOGGLE FULLSCREEN</button>
        </div>
        <div className="input-guide"><b>KEYBOARD</b><span>1–5 Select · Arrows Move · E Interact · F Focus · H Medicine · R Retreat · Space Pause</span><b>CONTROLLER</b><span>LB Select · D-pad Move · A Interact · RB Focus · X Medicine · B Retreat · Start Pause</span></div>
        <button className="text-back" onClick={() => setScreen('menu')}>← APPLY & RETURN</button>
      </section>}

      {screen === 'story' && <section className="story-screen">
        <img src={missionData.field} alt={`${missionData.title} operation site`} draggable={false} />
        <div className="story-shade" />
        <div className={`speaker-portrait portrait-${STORIES[mission - 1].lines[storyIndex]?.[2] ?? 0}`} />
        {storyIndex < STORIES[mission - 1].lines.length ? <div className="dialogue-box">
          <small>{STORIES[mission - 1].lines[storyIndex][0]}</small>
          <p>{STORIES[mission - 1].lines[storyIndex][1]}</p>
          <button className="primary" onClick={() => setStoryIndex((value) => value + 1)}>CONTINUE</button>
        </div> : <div className="dialogue-box choice-box">
          <small>FIELD DECISION</small><p>Orders do not absolve the rabbit who obeys them.</p>
          <button className="primary" onClick={() => resolveStoryChoice('mercy')}>{STORIES[mission - 1].choice[0]}</button>
          <button className="secondary" onClick={() => resolveStoryChoice('zeal')}>{STORIES[mission - 1].choice[1]}</button>
        </div>}
        <button className="story-skip" onClick={() => setStoryIndex(STORIES[mission - 1].lines.length)}>SKIP SCENE</button>
      </section>}

      {screen === 'briefing' && <section className="briefing-card">
        <span className="chapter">{activeContract ? 'BLACK ORDER · SCORING ENABLED' : missionData.chapter}</span>
        <h2>“{activeContract ? CONTRACTS.find((item) => item.id === activeContract)?.title : missionData.quote}”</h2>
        <p>{activeContract ? CONTRACTS.find((item) => item.id === activeContract)?.rule : missionData.objective}</p>
        <div className="orders"><span>PRIMARY ORDER</span><b>{missionData.title}</b><i /> <span>MISSION FAILURE</span><b>Squad wiped out or morale reduced to zero.</b></div>
        <div className={`doctrine doctrine-${doctrine}`}>{doctrine === 'mercy' ? 'MERCY DOCTRINE · improved health' : 'ZEAL DOCTRINE · improved morale'}</div>
        <div className="legacy-note">CAMPAIGN LEGACY · {mercyLegacy} medical decisions · {zealLegacy} zeal decisions · {campaign.casualties.length} permanent casualties recorded</div>
        <button className="primary" onClick={() => setScreen('playing')}>DEPLOY SQUAD</button>
        <button className="text-back" onClick={() => setScreen(activeContract ? 'contracts' : 'campaign')}>← CHANGE ASSIGNMENT</button>
      </section>}

      {(screen === 'playing' || screen === 'victory' || screen === 'defeat') && <>
        <div className="battlefield" ref={fieldRef} onClick={(event) => {
          if (screen !== 'playing') return
          const target = (event.target as HTMLElement).closest<HTMLElement>('.unit')
          if (target?.dataset.id) {
            const clicked = units.find((unit) => unit.id === target.dataset.id)
            if (clicked?.team === 'beast' && clicked.hp > 0 && focusMode && selected.length) {
              setUnits((current) => current.map((unit) => unit.selected ? { ...unit, attackTarget: clicked.id } : unit))
              setFocusMode(false)
              setToast(`Focus fire ordered on ${clicked.role.toUpperCase()} ${clicked.id}.`)
            } else if (clicked?.team === 'rabbit') selectUnit(clicked.id, event.shiftKey)
          } else issueMove(event)
        }}>
          {mission === 1 && units.filter((unit) => /^b[1-4]$/.test(unit.id) && unit.hp <= 0 && !collected.includes(unit.id)).map((unit) => <ObjectiveProp key={`jar-${unit.id}`} index={0} x={unit.x} y={unit.y - 2} label="Collect blood jar" onClick={() => collectBlood(unit.id, unit.x, unit.y)} />)}
          {mission === 2 && <ObjectiveProp index={1} x={47} y={48} label="Wounded bait convoy" />}
          {mission === 3 && <ObjectiveProp index={3} x={18} y={24} label="Chapel occupation point" />}
          {mission === 4 && <ObjectiveProp index={2} x={50} y={48} label="Blood extraction engine" />}
          {mission === 5 && [[0,24,28],[1,51,37],[2,79,25]].map(([index,x,y]) => <ObjectiveProp key={`burrow-${index}`} index={4} x={x} y={y} label={`Seal nursery burrow ${index + 1}`} sealed={sealedBurrows.includes(index)} onClick={() => sealBurrow(index, x, y)} />)}
          {mission === 6 && <ObjectiveProp index={5} x={82} y={24} label="Final blood altar" />}
          {units.map((unit) => <Sprite key={unit.id} unit={unit} frame={frame} />)}
          {events.map((event) => <Effect key={`${event.id}-${event.kind}-${event.x}-${event.y}`} event={event} />)}
        </div>
        {screen === 'playing' && <>
        <header className="mission-hud">
          <div><small>{missionData.chapter} · 17:42</small><strong>{missionData.title}</strong><em>{objectiveStatus}</em></div>
          <div className="morale"><span>SQUAD MORALE</span><b>{morale}</b><div className="bar-track"><i style={{ width: `${morale}%` }} /></div><em className={`terrain-status terrain-${selectedTerrain}`}>TERRAIN · {selectedTerrain.replace('-', ' ').toUpperCase()}</em></div>
          <div className="enemy-count"><span>MOONHORNS</span><b>{beastsAlive} / {missionData.enemies}</b></div>
        </header>
        <div className="toast">{toast}</div>
        <footer className="command-bar">
          <div className="portraits">
            {units.filter((unit) => unit.team === 'rabbit').map((unit, index) => <button key={unit.id} title={`${['Clover','Mallow','Pip','Rosary','Thistle'][index] ?? 'Rabbit'} · ${unit.role}`} onClick={() => selectUnit(unit.id, false)} className={unit.selected ? 'active' : ''}>
              <span className={`portrait-art portrait-slot-${index}`} /><span className="portrait-health"><i style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} /></span>
            </button>)}
          </div>
          <div className="commands">
            <button title="Move" onClick={() => { setFocusMode(false); setToast('Click an open position to move the selected squad.') }}><span className="effect-cell effect-5" /></button>
            <button title="Focus fire" className={focusMode ? 'active' : ''} onClick={() => { setFocusMode(true); setToast('Focus mode: click a living Moonhorn to mark it for the selected squad.') }}><span className="effect-cell effect-6" /></button>
            <button title={`Field medicine · ${medicalCharges} charges`} onClick={useMedicine}><span className="effect-cell effect-4" /></button>
            <button title="Retreat" onClick={() => setUnits((all) => all.map((u) => u.selected ? { ...u, target: { x: 12, y: 78 } } : u))}><span className="effect-cell effect-7" /></button>
          </div>
          <div className="speed-controls">
            <button onClick={() => setSpeed(0)} className={speed === 0 ? 'active' : ''}>Ⅱ</button>
            <button onClick={() => setSpeed(1)} className={speed === 1 ? 'active' : ''}>▶</button>
            <button onClick={() => setSpeed(2)} className={speed === 2 ? 'active' : ''}>▶▶</button>
          </div>
        </footer>
        </>}
      </>}

      {(screen === 'victory' || screen === 'defeat') && <section className={`end-card ${screen}`}>
        <span>{screen === 'victory' ? 'SURVIVOR REPORT' : 'CASUALTY REPORT'}</span>
        <h2>{screen === 'victory' ? mission === 6 ? endingCopy[0] : 'The valley is quiet.' : 'No rabbit came home.'}</h2>
        <p>{screen === 'victory' ? mission === 6 ? endingCopy[1] : `${rabbitsAlive} rabbits survived. The forest did not forgive them.` : 'The order remains correct. Everyone who carried it out is dead.'}</p>
        <div className="battle-stats"><span>SURVIVORS <b>{rabbitsAlive}</b></span><span>CASUALTIES <b>{casualtyCount}</b></span><span>MORALE <b>{morale}</b></span></div>
        <button className="primary" onClick={() => startMission(mission, activeContract)}>REDEPLOY</button>
        {screen === 'victory' && mission < 6 && !activeContract && <button className="primary" onClick={() => startMission(mission + 1)}>CONTINUE CAMPAIGN</button>}
        <button className="secondary" onClick={() => setScreen(activeContract ? 'contracts' : 'campaign')}>{activeContract ? 'CONTRACT BOARD' : 'OPERATIONS MAP'}</button>
      </section>}
    </main>
  </div>
}

export default App
