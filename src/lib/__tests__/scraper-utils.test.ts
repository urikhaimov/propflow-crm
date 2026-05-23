import { describe, it, expect } from 'vitest'
import {
  hasIntentKeyword,
  hasIsraelSignal,
  buildFingerprint,
  shouldSkipPost,
  parseLeadJson,
} from '../scraper-utils'

// ── hasIntentKeyword ──────────────────────────────────────────────────────────

describe('hasIntentKeyword', () => {
  it('matches English buyer intent', () => {
    expect(hasIntentKeyword('Looking for apartment in Tel Aviv')).toBe(true)
  })

  it('matches Hebrew buyer intent', () => {
    expect(hasIntentKeyword('מחפש דירה בתל אביב תקציב 3 מיליון')).toBe(true)
  })

  it('matches seller intent', () => {
    expect(hasIntentKeyword('I want to sell my apartment in Haifa')).toBe(true)
  })

  it('matches renter intent', () => {
    expect(hasIntentKeyword('Room for rent near university')).toBe(true)
  })

  it('matches investor intent', () => {
    expect(hasIntentKeyword('Looking to invest in israel real estate')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(hasIntentKeyword('LOOKING TO BUY in Tel Aviv')).toBe(true)
  })

  it('returns false for unrelated posts', () => {
    expect(hasIntentKeyword('Anyone know a good restaurant in Jerusalem?')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasIntentKeyword('')).toBe(false)
  })

  it('matches partial word in longer text', () => {
    expect(hasIntentKeyword('Hi everyone, relocating to israel next month and need apartment')).toBe(true)
  })
})

// ── hasIsraelSignal ───────────────────────────────────────────────────────────

describe('hasIsraelSignal', () => {
  it('detects "israel" keyword', () => {
    expect(hasIsraelSignal('apartment for sale in israel')).toBe(true)
  })

  it('detects Hebrew city name', () => {
    expect(hasIsraelSignal('דירה בתל אביב')).toBe(true)
  })

  it('detects Tel Aviv in English', () => {
    expect(hasIsraelSignal('moving to Tel Aviv next month')).toBe(true)
  })

  it('returns false for non-Israeli post', () => {
    expect(hasIsraelSignal('looking for flat in London')).toBe(false)
  })

  it('always returns true when fromIsraelSub=true regardless of text', () => {
    expect(hasIsraelSignal('looking for flat in London', true)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(hasIsraelSignal('Apartment in JERUSALEM')).toBe(true)
  })
})

// ── buildFingerprint ──────────────────────────────────────────────────────────

describe('buildFingerprint', () => {
  it('returns first 60 chars', () => {
    const text = 'a'.repeat(100)
    expect(buildFingerprint(text)).toBe('a'.repeat(60))
  })

  it('returns full string when shorter than 60 chars', () => {
    expect(buildFingerprint('short')).toBe('short')
  })

  it('returns empty string for empty input', () => {
    expect(buildFingerprint('')).toBe('')
  })
})

// ── shouldSkipPost ────────────────────────────────────────────────────────────

describe('shouldSkipPost', () => {
  const seenUrls = new Set(['https://reddit.com/r/Israel/post/abc'])
  const seenFingerprints = new Set(['This is a post that was already'])  // exactly 60 chars padded below

  it('skips a post whose URL was already seen', () => {
    expect(shouldSkipPost(
      { url: 'https://reddit.com/r/Israel/post/abc', text: 'New text' },
      seenUrls,
      new Set(),
    )).toBe(true)
  })

  it('skips a post whose fingerprint was already seen', () => {
    const alreadySeen = 'This is a post that was already seen so fingerprint matches exactly!!'
    const fps = new Set([buildFingerprint(alreadySeen)])
    expect(shouldSkipPost({ text: alreadySeen }, new Set(), fps)).toBe(true)
  })

  it('allows a post with a new URL and new fingerprint', () => {
    expect(shouldSkipPost(
      { url: 'https://reddit.com/r/Israel/post/xyz', text: 'Brand new post content' },
      seenUrls,
      new Set(),
    )).toBe(false)
  })

  it('allows a post with no URL when fingerprint is new', () => {
    expect(shouldSkipPost({ text: 'Unique post' }, seenUrls, new Set())).toBe(false)
  })

  it('skips even without URL when fingerprint matches', () => {
    const text = 'Repeated post content that should be filtered'
    const fps = new Set([buildFingerprint(text)])
    expect(shouldSkipPost({ text }, new Set(), fps)).toBe(true)
  })
})

// ── parseLeadJson ─────────────────────────────────────────────────────────────

describe('parseLeadJson', () => {
  it('parses plain JSON from Claude', () => {
    const raw = '{"intent_type":"buyer","city":"תל אביב","ai_score":85}'
    const result = parseLeadJson(raw)
    expect(result).toEqual({ intent_type: 'buyer', city: 'תל אביב', ai_score: 85 })
  })

  it('strips ```json fenced blocks', () => {
    const raw = '```json\n{"intent_type":"seller","city":"חיפה"}\n```'
    const result = parseLeadJson(raw)
    expect(result?.intent_type).toBe('seller')
  })

  it('returns null for literal "null" response', () => {
    expect(parseLeadJson('null')).toBe(null)
  })

  it('returns null for empty string', () => {
    expect(parseLeadJson('')).toBe(null)
  })

  it('returns null for whitespace-only string', () => {
    expect(parseLeadJson('   ')).toBe(null)
  })

  it('returns null for malformed JSON', () => {
    expect(parseLeadJson('{intent_type: buyer}')).toBe(null)
  })

  it('returns null when Claude returns an array instead of object', () => {
    expect(parseLeadJson('[{"intent_type":"buyer"}]')).toBe(null)
  })

  it('handles extra whitespace around JSON', () => {
    const raw = '\n  {"intent_type":"renter"}  \n'
    const result = parseLeadJson(raw)
    expect(result?.intent_type).toBe('renter')
  })

  it('returns null for partial/truncated JSON', () => {
    expect(parseLeadJson('{"intent_type":"buyer","city":')).toBe(null)
  })

  it('preserves all numeric fields', () => {
    const raw = '{"budget_min":1500000,"budget_max":3000000,"rooms":4,"ai_score":78}'
    const result = parseLeadJson(raw)
    expect(result?.budget_min).toBe(1500000)
    expect(result?.rooms).toBe(4)
  })
})
