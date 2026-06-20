// Neighborhood / area socioeconomic score, sourced from the CBS 2022 Census
// (data.gov.il). Score is 1-10 (higher = stronger socioeconomic profile),
// derived as the percentile rank across all localities of [median annual wage +
// % with an academic degree], averaged. See lib/data/socioeconomic-index.json
// _meta for provenance.
//
// This is the automated, unblocked baseline (Phase 1). Madlan's own neighborhood
// score — gated behind PerimeterX — is a future manual/cached layer on top.
import raw from './data/socioeconomic-index.json'

interface AreaEntry {
  score: number
  medWage: number | null
  academicPct: number | null
}

const BY_CITY = (raw as { byCity: Record<string, AreaEntry> }).byCity

// Mirror the build-time canonicalization so a lead's city string matches the
// keys (which are stripped of יפו/asterisks and collapsed whitespace).
const ALIAS: Record<string, string> = {
  'הרצלייה': 'הרצליה',
  'מודיעין-מכבים-רעות': 'מודיעין',
}

function normalizeCity(name: string): string {
  let n = name.trim().replace(/\*/g, '')
  n = n.replace(/\s*-?יפו$/, '') // "תל אביב-יפו" / "תל אביב יפו" → "תל אביב"
  n = n.replace(/\s+/g, ' ').trim()
  return ALIAS[n] || n
}

export interface AreaScore {
  score: number          // 1-10
  medWage: number | null // median annual wage (ILS)
  academicPct: number | null
}

/** Returns the socioeconomic area score for a city, or null if unknown. */
export function getAreaScore(city: string | null | undefined): AreaScore | null {
  if (!city) return null
  const entry = BY_CITY[normalizeCity(city)]
  return entry ? { score: entry.score, medWage: entry.medWage, academicPct: entry.academicPct } : null
}

/** Color for a 1-10 area score: green (8-10), amber (5-7), slate (1-4). */
export function areaScoreColor(score: number): string {
  if (score >= 8) return '#22c55e'
  if (score >= 5) return '#f59e0b'
  return '#64748b'
}

/** Short Hebrew label for a 1-10 area score. */
export function areaScoreLabel(score: number): string {
  if (score >= 8) return 'אזור חזק'
  if (score >= 5) return 'אזור בינוני'
  return 'אזור חלש'
}
