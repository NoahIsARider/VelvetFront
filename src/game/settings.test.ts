import { describe, expect, it } from 'vitest'
import { defaultSettings, parseSettings } from './settings'

describe('persisted game settings', () => {
  it('uses safe defaults for missing data', () => expect(parseSettings(null)).toEqual(defaultSettings()))
  it('clamps unsafe values', () => expect(parseSettings('{"master":900,"textScale":0.1}')).toMatchObject({ master: 100, textScale: .85 }))
})
