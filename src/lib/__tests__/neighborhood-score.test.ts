import { describe, it, expect } from 'vitest'
import { getAreaScore, areaScoreColor, areaScoreLabel } from '../neighborhood-score'

describe('getAreaScore', () => {
  it('returns a 1-10 score for a known city', () => {
    const tlv = getAreaScore('תל אביב')
    expect(tlv).not.toBeNull()
    expect(tlv!.score).toBeGreaterThanOrEqual(1)
    expect(tlv!.score).toBeLessThanOrEqual(10)
  })

  it('normalizes the יפו suffix', () => {
    expect(getAreaScore('תל אביב-יפו')?.score).toBe(getAreaScore('תל אביב')?.score)
    expect(getAreaScore('תל אביב יפו')?.score).toBe(getAreaScore('תל אביב')?.score)
  })

  it('resolves spelling/name aliases', () => {
    expect(getAreaScore('הרצליה')).not.toBeNull() // CBS spells it הרצלייה
    expect(getAreaScore('מודיעין')).not.toBeNull() // CBS: מודיעין-מכבים-רעות
  })

  it('reflects known socioeconomic ordering', () => {
    // Givatayim (affluent) should outscore Bnei Brak (low cluster)
    expect(getAreaScore('גבעתיים')!.score).toBeGreaterThan(getAreaScore('בני ברק')!.score)
  })

  it('returns null for unknown / empty input', () => {
    expect(getAreaScore('עיר שלא קיימת כלל')).toBeNull()
    expect(getAreaScore('')).toBeNull()
    expect(getAreaScore(null)).toBeNull()
    expect(getAreaScore(undefined)).toBeNull()
  })
})

describe('areaScore helpers', () => {
  it('colors by band', () => {
    expect(areaScoreColor(9)).toBe('#22c55e')
    expect(areaScoreColor(6)).toBe('#f59e0b')
    expect(areaScoreColor(2)).toBe('#64748b')
  })
  it('labels by band', () => {
    expect(areaScoreLabel(9)).toContain('חזק')
    expect(areaScoreLabel(2)).toContain('חלש')
  })
})
