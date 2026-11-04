export interface GameSettings {
  master: number
  music: number
  sfx: number
  textScale: number
  reducedMotion: boolean
  highContrast: boolean
}

export const defaultSettings = (): GameSettings => ({ master: 80, music: 55, sfx: 75, textScale: 1, reducedMotion: false, highContrast: false })

export function parseSettings(raw: string | null): GameSettings {
  if (!raw) return defaultSettings()
  try {
    const value = { ...defaultSettings(), ...JSON.parse(raw) }
    return {
      master: Math.max(0, Math.min(100, Number(value.master))),
      music: Math.max(0, Math.min(100, Number(value.music))),
      sfx: Math.max(0, Math.min(100, Number(value.sfx))),
      textScale: Math.max(.85, Math.min(1.3, Number(value.textScale))),
      reducedMotion: Boolean(value.reducedMotion),
      highContrast: Boolean(value.highContrast),
    }
  } catch { return defaultSettings() }
}
