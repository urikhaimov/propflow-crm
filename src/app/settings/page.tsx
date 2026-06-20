'use client'
// app/settings/page.tsx — Integrations & channel configuration
import { useEffect, useState } from 'react'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'

interface IntegrationStatus {
  capture_form: boolean
  whatsapp: boolean
  facebook: boolean
  telegram: boolean
  app_url: string
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      ok ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-slate-500'}`} />
      {ok ? 'מחובר' : 'לא מוגדר'}
    </span>
  )
}

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(children).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative group">
      <pre className="bg-slate-950 border border-white/8 rounded-xl p-4 text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{children}</pre>
      <button onClick={copy}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300">
        {copied ? '✅' : '📋'}
      </button>
    </div>
  )
}

function CrawlButton({ source, label }: { source: string; label: string }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState('')

  async function run() {
    setState('running')
    try {
      const res = await fetch('/api/crawl/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: [source] }),
      })
      const d = await res.json()
      setResult(`נשמרו ${d.saved} לידים מתוך ${d.scanned} פוסטים`)
      setState('done')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 5000)
  }

  return (
    <button onClick={run} disabled={state === 'running'}
      className={`w-full py-2 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
        state === 'done' ? 'bg-green-500/15 text-green-300' :
        state === 'error' ? 'bg-red-500/15 text-red-300' :
        'bg-orange-500/15 hover:bg-orange-500/25 text-orange-300'
      }`}>
      {state === 'running' ? `סורק ${label}…` :
       state === 'done' ? `✅ ${result}` :
       state === 'error' ? '❌ שגיאה בסריקה' :
       `▶ הפעל סריקת ${label} עכשיו`}
    </button>
  )
}

function TelegramSetupButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function register() {
    setState('running')
    try {
      const res = await fetch('/api/webhooks/telegram/setup', { method: 'POST' })
      const d = await res.json()
      if (d.ok) {
        setMsg(`✅ Webhook רשום: ${d.webhookUrl}`)
        setState('done')
      } else {
        setMsg(`❌ ${d.error || d.description || 'שגיאה'}`)
        setState('error')
      }
    } catch {
      setMsg('❌ שגיאת רשת')
      setState('error')
    }
  }

  return (
    <div className="space-y-2">
      <button onClick={register} disabled={state === 'running'}
        className={`w-full py-2 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
          state === 'done' ? 'bg-green-500/15 text-green-300' :
          state === 'error' ? 'bg-red-500/15 text-red-300' :
          'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300'
        }`}>
        {state === 'running' ? 'רושם Webhook…' : '🔗 רשום Webhook עם Telegram'}
      </button>
      {msg && <p className="text-xs text-slate-400 break-all">{msg}</p>}
    </div>
  )
}

function IntegrationCard({
  icon, title, status, children,
}: {
  icon: string
  title: string
  status: boolean
  children: React.ReactNode
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{title}</div>
        </div>
        <StatusPill ok={status} />
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)

  useEffect(() => {
    fetch('/api/integrations/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => {})
  }, [])

  const base = status?.app_url || 'https://yourdomain.com'

  return (
    <CRMLayout>
      <Topbar title="הגדרות ואינטגרציות" />
      <div className="flex-1 overflow-y-auto p-3 md:p-5" dir="rtl">
        <div className="max-w-2xl space-y-5">

          {/* Lead Capture Form */}
          <IntegrationCard icon="🌐" title="טופס לידים — אתר" status={status?.capture_form ?? true}>
            <p className="text-xs text-slate-400 mb-3">
              הטמיעו את הטופס בכל עמוד באתר שלכם. לידים שמגיעים דרכו נוצרים אוטומטית עם ציון AI.
            </p>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 mb-1">קישור ישיר לטופס</div>
              <CodeBlock>{`${base}/capture`}</CodeBlock>
              <div className="text-xs text-slate-500 mb-1 mt-3">קוד הטמעה (iframe)</div>
              <CodeBlock>{`<iframe\n  src="${base}/capture"\n  width="480"\n  height="680"\n  frameborder="0"\n  style="border-radius:16px"\n></iframe>`}</CodeBlock>
            </div>
          </IntegrationCard>

          {/* WhatsApp */}
          <IntegrationCard icon="💬" title="WhatsApp Business" status={status?.whatsapp ?? false}>
            {status?.whatsapp ? (
              <p className="text-xs text-green-400 mb-3">
                WhatsApp מחובר. הודעות נכנסות מומרות ללידים אוטומטית עם תגובה בעברית.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-3">
                הגדירו את המשתנים הבאים ב-<code className="bg-slate-800 px-1 rounded">.env.local</code> ורשמו את ה-Webhook ב-Meta Business Manager.
              </p>
            )}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 mb-1">Webhook URL לרישום ב-Meta</div>
              <CodeBlock>{`${base}/api/webhooks/whatsapp`}</CodeBlock>
              <div className="text-xs text-slate-500 mb-1 mt-3">משתני סביבה נדרשים</div>
              <CodeBlock>{`WHATSAPP_VERIFY_TOKEN=your-secret-string\nWHATSAPP_PHONE_NUMBER_ID=123456789\nWHATSAPP_ACCESS_TOKEN=EAAxxxxxxx`}</CodeBlock>
            </div>
          </IntegrationCard>

          {/* Facebook Lead Ads */}
          <IntegrationCard icon="📘" title="Facebook Lead Ads" status={status?.facebook ?? false}>
            {status?.facebook ? (
              <p className="text-xs text-green-400 mb-3">
                Facebook מחובר. לידים מהמודעות שלכם נכנסים אוטומטית לCRM עם ניקוד AI.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-3">
                הגדירו אפליקציית Meta, הוסיפו את ה-Webhook לדף הפייסבוק שלכם, ורשמו את המשתנים ב-<code className="bg-slate-800 px-1 rounded">.env.local</code>.
              </p>
            )}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 mb-1">Webhook URL לרישום ב-Meta</div>
              <CodeBlock>{`${base}/api/webhooks/facebook`}</CodeBlock>
              <div className="text-xs text-slate-500 mb-1 mt-3">שדה Webhook לרשום: <code className="bg-slate-800 px-1 rounded">leadgen</code></div>
              <div className="text-xs text-slate-500 mb-1 mt-3">משתני סביבה נדרשים</div>
              <CodeBlock>{`FACEBOOK_VERIFY_TOKEN=your-secret-string\nFACEBOOK_PAGE_ACCESS_TOKEN=EAAxxxxxxx`}</CodeBlock>
            </div>
          </IntegrationCard>

          {/* Telegram */}
          <IntegrationCard icon="✈️" title="Telegram Bot" status={status?.telegram ?? false}>
            {status?.telegram ? (
              <p className="text-xs text-green-400 mb-3">
                Telegram Bot מוגדר. רשמו את ה-Webhook כדי להתחיל לקבל הודעות.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-3">
                צרו Bot דרך @BotFather, קבלו Token, והוסיפו למשתני הסביבה. לאחר מכן לחצו על כפתור הרישום.
              </p>
            )}
            <div className="space-y-3">
              <div className="text-xs text-slate-500 mb-1">משתני סביבה נדרשים</div>
              <CodeBlock>{`TELEGRAM_BOT_TOKEN=123456789:AAF...\nTELEGRAM_WEBHOOK_SECRET=your-secret-string`}</CodeBlock>
              <div className="text-xs text-slate-500 mb-1 mt-3">Webhook URL (לידיעה — הרישום אוטומטי)</div>
              <CodeBlock>{`${base}/api/webhooks/telegram`}</CodeBlock>
              <TelegramSetupButton />
            </div>
          </IntegrationCard>

          {/* Telegram auto-crawl */}
          <IntegrationCard icon="🤖" title="טלגרם — סריקה אוטומטית" status={true}>
            <p className="text-xs text-slate-400 mb-3">
              המערכת סורקת ערוצי נדל"ן ציבוריים בטלגרם אוטומטית פעם ביום דרך Vercel Cron.
              לידים עם ציון ≥ 60 נשמרים לCRM אוטומטית ומגיעה התראה לצוות.
              דורש חיבור MTProto (ראו משתני הסביבה למטה).
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-indigo-400">פעם ביום</div>
                  <div className="text-xs text-slate-500">תדירות סריקה</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-amber-400">15 פוסטים</div>
                  <div className="text-xs text-slate-500">מקסימום לריצה</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-green-400">ציון ≥ 60</div>
                  <div className="text-xs text-slate-500">סף שמירה</div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mb-1">הפעלה ידנית מיידית</div>
              <CrawlButton source="telegram" label="טלגרם" />
              <div className="text-xs text-slate-500 mb-1 mt-2">משתני סביבה נדרשים (ראו AGENTS.md — סקריפט התחברות חד-פעמי)</div>
              <CodeBlock>{`TELEGRAM_API_ID=1234567\nTELEGRAM_API_HASH=abc...\nTELEGRAM_SESSION=1Ab...\nCRON_SECRET=your-secret-string`}</CodeBlock>
            </div>
          </IntegrationCard>

          {/* Alljobs auto-crawl */}
          <IntegrationCard icon="💼" title="AllJobs — סריקת משרות עם רילוקיישן" status={true}>
            <p className="text-xs text-slate-400 mb-3">
              אנשים שמחפשים עבודה בעיר חדשה = לידים פוטנציאליים לשכירות או קנייה.
              המערכת סורקת משרות עם חבילת רילוקיישן או ציון עיר, ו-Claude מחליט האם יש כאן ליד נדל"ן.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-indigo-400">כל 6 שעות</div>
                  <div className="text-xs text-slate-500">תדירות סריקה</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-amber-400">40 מודעות</div>
                  <div className="text-xs text-slate-500">מקסימום לריצה</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-semibold text-green-400">ציון ≥ 60</div>
                  <div className="text-xs text-slate-500">סף שמירה</div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mb-1">הפעלה ידנית מיידית</div>
              <CrawlButton source="alljobs" label="AllJobs" />
            </div>
          </IntegrationCard>

          {/* Source breakdown hint */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">📊</div>
              <div className="font-semibold text-sm">מקורות לידים</div>
            </div>
            <p className="text-xs text-slate-400">
              כל ליד שנכנס — בין אם מהאתר, מ-WhatsApp, מ-Facebook, מהגילוי ה-AI, או ידנית — מתועד עם <code className="bg-slate-800 px-1 rounded">source_platform</code> מתאים ומופיע בלוח הבקרה בפילוח לפי מקור.
            </p>
          </div>

        </div>
      </div>
    </CRMLayout>
  )
}
