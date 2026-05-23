'use client'
import { useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { Spinner } from '@/components/ui'

type TestResult = {
  ok?: boolean
  [key: string]: any
}

function StatusChip({ ok }: { ok?: boolean }) {
  if (ok === undefined) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">—</span>
  return ok
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ עבר</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">✗ נכשל</span>
}

function TestCard({ title, result, children }: { title: string; result?: TestResult; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition text-right"
      >
        <div className="flex items-center gap-3">
          <StatusChip ok={result?.ok} />
          <span className="text-sm font-medium">{title}</span>
          {result?.latency_ms && (
            <span className="text-xs text-slate-600">{result.latency_ms}ms</span>
          )}
        </div>
        <span className="text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-3 space-y-2">
          {children}
          {result && (
            <pre className="text-xs text-slate-400 bg-slate-950 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, ok }: { label: string; value?: string | number | null; ok?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500 w-36 flex-shrink-0">{label}</span>
      <span className={ok === false ? 'text-red-400' : ok === true ? 'text-green-400' : 'text-slate-300'}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export default function DebugPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)
  const [error, setError]     = useState('')
  const [ts, setTs]           = useState('')

  async function runTests() {
    setLoading(true)
    setError('')
    setResult(null)
    setTs('')
    try {
      const res = await fetch('/api/debug/scraper', { cache: 'no-store' })
      const data = await res.json()
      setResult(data)
      setTs(new Date().toLocaleTimeString('he-IL'))
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const t = result?.tests || {}

  return (
    <CRMLayout>
      <Topbar title="אבחון מערכת" />
      <div className="flex-1 overflow-y-auto p-5" dir="rtl">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="glass rounded-xl p-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold mb-1">בדיקת מערכת הסריקה</h2>
              <p className="text-xs text-slate-500">בודק כל שלב בנפרד — API, Reddit, חילוץ Claude, מסלול מלא</p>
              {ts && <p className="text-xs text-slate-600 mt-1">הופעל: {ts}</p>}
            </div>
            <button
              onClick={runTests}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-xl text-sm font-semibold transition flex items-center gap-2"
            >
              {loading ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin inline-block" /> מבצע...</> : '▶ הרץ בדיקות'}
            </button>
          </div>

          {error && (
            <div className="glass rounded-xl p-4 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          {loading && <Spinner />}

          {result && !loading && (
            <>
              {/* Summary */}
              <div className={`rounded-xl p-4 border text-sm font-medium ${
                result.ok
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}>
                {result.ok ? '✓ כל הבדיקות עברו — מערכת הסריקה תקינה' : '✗ חלק מהבדיקות נכשלו — ראו פרטים למטה'}
              </div>

              {/* ENV */}
              <TestCard title="משתני סביבה" result={{ ok: !!t.env?.anthropic_key?.startsWith('✓') }}>
                <div className="space-y-1.5">
                  <Row label="ANTHROPIC_API_KEY" value={t.env?.anthropic_key} ok={t.env?.anthropic_key?.startsWith('✓')} />
                  <Row label="NEXT_PUBLIC_APP_URL" value={t.env?.app_url} />
                  <Row label="SUPABASE_URL" value={t.env?.supabase_url} ok={t.env?.supabase_url?.startsWith('✓')} />
                  <Row label="GOOGLE_SEARCH (אופציונלי)" value={t.env?.google_key} />
                </div>
              </TestCard>

              {/* Claude API */}
              <TestCard title="Claude API — חיבור" result={t.claude}>
                {t.claude?.ok ? (
                  <Row label="תגובה" value={`${t.claude.response} (${t.claude.latency_ms}ms)`} ok />
                ) : (
                  <Row label="שגיאה" value={t.claude?.error} ok={false} />
                )}
              </TestCard>

              {/* Reddit */}
              <TestCard title="Reddit — שליפת פוסטים" result={t.reddit}>
                {t.reddit?.ok ? (
                  <div className="space-y-1.5">
                    <Row label="פוסטים שהוחזרו" value={t.reddit.posts_returned} ok={t.reddit.posts_returned > 0} />
                    <Row label="סאברדיטים" value={(t.reddit.subreddits || []).join(', ')} />
                    {(t.reddit.sample_titles || []).map((title: string, i: number) => (
                      <Row key={i} label={`דוגמה ${i + 1}`} value={title} />
                    ))}
                  </div>
                ) : (
                  <Row label="שגיאה" value={t.reddit?.error || `HTTP ${t.reddit?.status}`} ok={false} />
                )}
              </TestCard>

              {/* Intent filter */}
              {t.intent_filter && (
                <TestCard
                  title="פילטר כוונות — כמה פוסטים עוברים"
                  result={{ ok: (t.intent_filter.passing_filter ?? 0) > 0 }}
                >
                  <div className="space-y-1.5">
                    <Row label="סה״כ פוסטים" value={t.intent_filter.total_posts} />
                    <Row
                      label="עוברים פילטר"
                      value={t.intent_filter.passing_filter}
                      ok={t.intent_filter.passing_filter > 0}
                    />
                    {t.intent_filter.note && (
                      <p className="text-xs text-amber-400 mt-1">{t.intent_filter.note}</p>
                    )}
                    {(t.intent_filter.sample_passing || []).map((p: any, i: number) => (
                      <Row key={i} label={`עובר ${i + 1}`} value={`${p.subreddit}: ${p.title}`} />
                    ))}
                    {t.intent_filter.passing_filter === 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        ייתכן שReddit שקט כעת — השתמשו בהדבקה ידנית במקום.
                      </p>
                    )}
                  </div>
                </TestCard>
              )}

              {/* Claude extraction */}
              <TestCard title="חילוץ Claude — פוסט לדוגמה" result={t.extraction}>
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500 mb-2 italic">"{t.extraction?.sample_post?.substring(0, 120)}..."</div>
                  {t.extraction?.ok ? (
                    <>
                      <Row label="intent_type" value={t.extraction.parsed_lead?.intent_type} ok />
                      <Row label="city" value={t.extraction.parsed_lead?.city} />
                      <Row label="budget_max" value={t.extraction.parsed_lead?.budget_max?.toLocaleString()} />
                      <Row label="ai_score" value={t.extraction.parsed_lead?.ai_score} />
                    </>
                  ) : (
                    <Row label="שגיאה" value={t.extraction?.error || t.extraction?.raw_response} ok={false} />
                  )}
                </div>
              </TestCard>

              {/* End-to-end */}
              <TestCard title="מסלול מלא — ידני → /api/crawl → Claude" result={t.end_to_end}>
                <div className="space-y-1.5">
                  <Row label="פוסטים שנסרקו" value={t.end_to_end?.scanned} />
                  <Row label="לידים שחולצו" value={t.end_to_end?.extracted} ok={t.end_to_end?.extracted > 0} />
                  {t.end_to_end?.lead && (
                    <>
                      <Row label="ליד ראשון" value={`${t.end_to_end.lead.intent_type} — ${t.end_to_end.lead.city}`} ok />
                      <Row label="ai_score" value={t.end_to_end.lead.ai_score} />
                    </>
                  )}
                  {(t.end_to_end?.errors || []).length > 0 && (
                    <div className="text-xs text-red-400 mt-1">
                      שגיאות: {t.end_to_end.errors.join(' | ')}
                    </div>
                  )}
                  {(t.end_to_end?.debug_log || []).length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-slate-500 mb-1">לוג:</div>
                      {t.end_to_end.debug_log.map((line: string, i: number) => (
                        <div key={i} className="text-xs text-slate-400 font-mono">{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              </TestCard>

              {/* What to do if broken */}
              {!result.ok && (
                <div className="glass rounded-xl p-4 space-y-2" dir="rtl">
                  <div className="text-xs font-semibold text-slate-400 mb-2">איך לתקן:</div>
                  {!t.claude?.ok && (
                    <p className="text-xs text-slate-500">• Claude נכשל: בדקו ש-<code className="text-amber-400">ANTHROPIC_API_KEY</code> מוגדר ב-.env.local ולא מתחיל ב-NEXT_PUBLIC_</p>
                  )}
                  {t.reddit?.posts_returned === 0 && (
                    <p className="text-xs text-slate-500">• Reddit החזיר 0 פוסטים: Reddit עשוי להיות שקט כעת. נסו מחר או השתמשו בהדבקה ידנית.</p>
                  )}
                  {t.intent_filter?.passing_filter === 0 && t.reddit?.posts_returned > 0 && (
                    <p className="text-xs text-slate-500">• פוסטים נמצאו אך לא עוברים פילטר כוונות: הפוסטים הנוכחיים ב-Reddit לא קשורים לנדל&quot;ן ישראלי.</p>
                  )}
                  {!t.end_to_end?.ok && t.claude?.ok && (
                    <p className="text-xs text-slate-500">• המסלול המלא נכשל: בדקו ש-<code className="text-amber-400">NEXT_PUBLIC_APP_URL=http://localhost:3000</code> מוגדר.</p>
                  )}
                </div>
              )}
            </>
          )}

          {!result && !loading && (
            <div className="glass rounded-xl p-10 text-center">
              <div className="text-3xl mb-3">🔧</div>
              <div className="text-slate-400 text-sm">לחצו &quot;הרץ בדיקות&quot; לאבחון מערכת הסריקה</div>
            </div>
          )}
        </div>
      </div>
    </CRMLayout>
  )
}
