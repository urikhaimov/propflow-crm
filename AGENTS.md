# PropFlow CRM — Agent Instructions

## 🚀 Workflow & Verification

- **MANDATORY — BRANCH STRATEGY:** Default working branch is `dev`, never `main`. `main` is the deploy target — pushing to it triggers a production rollout on Vercel, so it stays untouched while a feature is in flight. Every new feature lives on its own `feature/<name>` branch cut from `dev`; every bug fix on `bug/<name>` cut from `dev`. PRs only target `dev`; the merge `dev → main` is performed manually when a batch is ready to ship. Never push commits directly to `main`.

- **MANDATORY — NO CODE CHANGES WITHOUT APPROVAL:** Never edit, create, or delete source files without explicit approval. Always propose the change first, explain what will be modified, and wait for a go-ahead before writing any code.

- **MANDATORY — ONE COMPONENT PER FILE:** Each React component lives in its own `.tsx` file. Layout → `components/layout/`, lead-specific → `components/leads/`, shared UI → `components/ui/`. Never co-locate two exported components in one file.

- **MANDATORY — POST-CODING ROUTINE:** After every coding task, before committing:
  1. `npm run build` — must pass with zero errors
  2. `npm run lint` — must pass clean
  3. Update `AGENTS.md` if architecture, schema, or env vars changed
  No commit lands with a red build or red lint.

- **MANDATORY — ALL AI CALLS SERVER-SIDE:** Never call the Anthropic API directly from the browser. All AI calls go through `lib/ai.ts` → `POST /api/ai`. The `/api/ai` route reads `ANTHROPIC_API_KEY` from the server environment. `ANTHROPIC_API_KEY` must never have a `NEXT_PUBLIC_` prefix.

- **MANDATORY — NO POSTGRESQL ENUMS:** Never create or recreate any column as a PostgreSQL ENUM type. All status and type fields must be plain `text`. The original project used enums for `property_status` and lead `status` — both were dropped and replaced with text. Adding enums back will break inserts.

- **Clean Code:** Remove unused imports, avoid duplicated logic. Never hardcode Hebrew strings in components — use `lib/utils.ts` label maps (`intentLabel`, `statusLabel`). Keep Supabase queries using `select('*')` — never enumerate columns (the schema evolved; specific column selects cause 400s when columns are missing).

- **Supabase migrations:** Never use `apply_migration`. Write SQL files in `supabase/`, apply via Supabase SQL Editor, document schema changes in this file. Always use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (non-destructive). Always `DROP POLICY IF EXISTS` before `CREATE POLICY`.

---

## 🏗 Architecture

### Project Structure
```
crm-agency/                              ← project root (NO src/ folder — see critical note)
├── app/                                 ← Next.js App Router pages
│   ├── layout.tsx                       ← Root layout; sets lang="he" dir="rtl", loads Inter font
│   ├── page.tsx                         ← redirect() → /dashboard
│   ├── globals.css                      ← Dark theme, .glass utility, custom scrollbar, animations
│   ├── dashboard/page.tsx               ← Stats grid, bar chart, city heatmap, hot leads, intent breakdown
│   ├── leads/page.tsx                   ← Leads table + intent/status/city filters + LeadDetailPanel
│   ├── pipeline/page.tsx                ← Kanban (6 cols: new→contacted→qualified→negotiating→won→lost)
│   ├── properties/page.tsx              ← Property card grid + AddProperty modal
│   ├── discovery/page.tsx               ← AI crawler UI: source selector, keyword, manual paste, log, results
│   ├── matching/page.tsx                ← AI buyer↔property matching with score + Hebrew explanation
│   ├── search/page.tsx                  ← Natural language search via Claude + saved searches sidebar
│   ├── agents/page.tsx                  ← Agent cards + performance table; tries agents→agencies→mock
│   ├── notifications/page.tsx           ← Notification feed; reads from Supabase, falls back to mock
│   └── api/
│       ├── ai/route.ts                  ← POST — Claude proxy; injects API key, enforces model, max_tokens
│       ├── crawl/route.ts               ← POST — orchestrates Telegram+Yad2+Madlan+manual → Claude extraction
│       └── telegram/route.ts            ← GET  — MTProto channel history (t.me/s/ preview fallback)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                  ← Nav links, hot-lead badge (ai_score≥80), unread notif badge
│   │   ├── Topbar.tsx                   ← Page title, global search input → store.searchQuery, notif bell
│   │   └── CRMLayout.tsx                ← dir="rtl" wrapper: <Sidebar/> + <div>{children}</div>
│   ├── leads/
│   │   ├── LeadDetailPanel.tsx          ← Slide-in: AI score bar, contact, budget, original post,
│   │   │                                   status buttons, AI email generator, Find Matches / Schedule
│   │   └── AddLeadModal.tsx             ← 2-col form → createLead() → scoreLeadWithAI() → addLead(store)
│   └── ui/
│       └── index.tsx                    ← All shared primitives (see UI Components section)
├── lib/
│   ├── supabase.ts                      ← createClient singleton; uses NEXT_PUBLIC_ vars
│   ├── leads.ts                         ← getLeads(filters), getLead(id), createLead, updateLead,
│   │                                       deleteLead, getDashboardStats (defensive: ??  fallbacks)
│   ├── properties.ts                    ← getProperties, createProperty, updateProperty, deleteProperty
│   ├── ai.ts                            ← callClaude() internal helper → all 5 exported AI functions
│   └── utils.ts                         ← fmt, scoreColor, intentColor, intentLabel, statusLabel,
│                                           initials, timeAgo, cn
├── store/
│   └── crm.ts                           ← Zustand store (see State Management section)
├── types/
│   └── index.ts                         ← All TS types and interfaces (see Types section)
├── supabase/
│   ├── fix_leads.sql                    ← ALTER TABLE leads ADD COLUMN IF NOT EXISTS ... (+ seed 6 leads)
│   └── fix_properties.sql               ← DROP TABLE properties CASCADE + DROP TYPE enums + recreate
├── next.config.js                       ← /** @type... */ const nextConfig = {} — intentionally empty
├── tailwind.config.ts                   ← content: ['./app/**', './components/**']
├── tsconfig.json                        ← paths: { "@/*": ["./*"] } — maps to root, NOT src/
└── package.json                         ← next@14.2.0, react@18, zustand@4.5, supabase-js@2.39
```

### ⚠️ Critical: No `src/` Folder
```jsonc
// tsconfig.json
"paths": { "@/*": ["./*"] }   // maps to PROJECT ROOT
```
- `@/components/layout/Sidebar` → `./components/layout/Sidebar.tsx` ✅
- `@/lib/leads` → `./lib/leads.ts` ✅
- **Never create a `src/` folder.** Doing so causes all pages to 404 because Next.js finds no routes in `app/` at root level, and all `@/` imports resolve to wrong paths.

---

## 🗄 Database Schema (Supabase / PostgreSQL)

> **Rule:** All status and type columns are plain `text`. Zero enums in this project.

### `leads`
| Column | Type | Values / Notes |
|---|---|---|
| id | uuid PK | `uuid_generate_v4()` |
| first_name | text | required |
| last_name | text | required |
| email | text | optional |
| phone | text | optional |
| source_platform | text | facebook, telegram, yad2, reddit, twitter, linkedin, manual, crawler |
| original_post | text | raw source text (up to 500 chars stored) |
| source_url | text | link to Reddit post, Google result, etc. |
| intent_type | text | **buyer \| seller \| renter \| investor** |
| city | text | Hebrew city name |
| neighborhood | text | Hebrew neighborhood |
| budget_min | numeric | ILS |
| budget_max | numeric | ILS |
| rooms | integer | |
| property_type | text | apartment \| villa \| penthouse \| studio \| commercial \| land |
| urgency_score | integer | 0–100, AI-generated |
| ai_score | integer | 0–100, AI-generated |
| ai_summary | text | 1–3 sentences in Hebrew, AI-generated |
| ai_follow_up | text | personalized Hebrew message, AI-generated |
| status | text | **new \| contacted \| qualified \| negotiating \| won \| lost** |
| tags | text[] | AI-generated: `['דחוף','משפחה','משקיע',...]` |
| notes | text | manual agent notes |
| assigned_agent_id | uuid | FK → agents.id (nullable) |
| lead_score | integer | legacy column from original project — maps to ai_score |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto via trigger |

**Defensive reads:** `lib/leads.ts` always uses `select('*')` and reads fields with `??` fallbacks:
- `l.ai_score ?? l.lead_score ?? 0`
- `l.budget_max ?? l.budget ?? 0`
- `l.source_platform || l.source || 'manual'`

### `properties`
| Column | Type | Values / Notes |
|---|---|---|
| id | uuid PK | |
| title | text | required |
| address | text | |
| city | text | |
| neighborhood | text | |
| rooms | integer | |
| area | numeric | m² |
| floor | integer | |
| total_floors | integer | |
| price | numeric | ILS for sale; ILS/month for rental |
| is_rental | boolean | false = for sale, true = for rent |
| property_type | text | apartment \| villa \| penthouse \| studio \| commercial \| land |
| status | text | **available \| reserved \| sold \| rented** |
| description | text | |
| images | text[] | array of URLs |
| owner_name | text | |
| owner_phone | text | |
| listing_source | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `agents`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| email | text | unique |
| phone | text | |
| role | text | admin \| senior_agent \| agent \| junior_agent \| user |
| avatar_url | text | |
| is_active | boolean | default true |
| created_at | timestamptz | |

> **Gotcha:** Original project table is named `agencies`, not `agents`. `app/agents/page.tsx` tries `agents` first, then `agencies`, then falls back to 4 hardcoded mock agents. When creating the `agents` table, run the SQL from `supabase/schema.sql`.

### `lead_property_matches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid | FK → leads.id ON DELETE CASCADE |
| property_id | uuid | FK → properties.id ON DELETE CASCADE |
| match_score | integer | 0–100 |
| match_reason | text | Hebrew AI explanation |
| created_at | timestamptz | |
| | | UNIQUE(lead_id, property_id) |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| agent_id | uuid | FK → agents.id ON DELETE CASCADE |
| type | text | hot_lead \| match \| seller \| crawler \| system |
| title | text | |
| body | text | |
| lead_id | uuid | nullable FK → leads |
| property_id | uuid | nullable FK → properties |
| is_read | boolean | default false |
| created_at | timestamptz | |

> `app/notifications/page.tsx` falls back to 7 hardcoded mock notifications when the table is empty or missing.

### `activities` (schema defined, not yet wired to UI)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| lead_id | uuid | nullable FK → leads |
| property_id | uuid | nullable FK → properties |
| agent_id | uuid | nullable FK → agents |
| type | text | note \| call \| email \| status_change \| match \| discovery |
| content | text | |
| metadata | jsonb | |
| created_at | timestamptz | |

### `saved_searches` (schema defined, not yet wired to UI)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| agent_id | uuid | FK → agents |
| name | text | |
| filters | jsonb | serialized `LeadFilters` object |
| alert_enabled | boolean | |
| created_at | timestamptz | |

### RLS Pattern
```sql
-- Always in this order:
alter table <table> enable row level security;
drop policy if exists "Allow all for authenticated" on <table>;
create policy "Allow all for authenticated" on <table>
  for all using (auth.role() = 'authenticated');
```

---

## 🤖 AI Architecture

### Request Flow
```
Component (browser)
  └─ lib/ai.ts → callClaude()
       └─ POST /api/ai  { system, messages }
            └─ app/api/ai/route.ts  (server)
                 reads ANTHROPIC_API_KEY from process.env
                 injects: model, max_tokens, anthropic-version
                 └─ https://api.anthropic.com/v1/messages
```

### `/api/ai` route behaviour
- Model: always `claude-sonnet-4-20250514` — never override per-call
- `max_tokens`: 1000 (default) — callers in `lib/ai.ts` use 600 for extraction (cost control)
- Accepts: `{ system, messages, ...rest }` — spreads rest onto Anthropic body
- Returns: raw Anthropic response JSON → callers read `data.content[0].text`
- On missing API key: returns `{ error }` with HTTP 500

### AI Functions (`lib/ai.ts`)
| Function | Input | Output | Called from | Cost |
|---|---|---|---|---|
| `scoreLeadWithAI(lead)` | `Partial<Lead>` | `{ ai_score, urgency_score, ai_summary, ai_follow_up, tags }` | `AddLeadModal` | ~500 tokens |
| `matchLeadsToProperty(property, leads)` | `Property, Lead[]` | `Array<{ lead_id, score, reason }>` | `matching/page` | ~400 tokens |
| `extractLeadFromPost(text, source)` | `string, string` | `Partial<Lead> \| null` | `discovery/page` via `/api/crawl` | ~300 tokens |
| `aiSearchLeads(query, leads)` | `string, Lead[]` | `Lead[]` | `search/page` | ~300 tokens |
| `generateEmail(lead, context)` | `Lead, string` | `string` (Hebrew email) | `LeadDetailPanel` | ~200 tokens |

### Prompt Rules
- Always instruct: `Return ONLY valid JSON, no markdown, no explanation`
- Always `JSON.parse()` inside `try/catch` with a hardcoded Hebrew fallback
- Cap post text at 600–800 chars before sending (saves ~$0.002/call)
- All user-facing output (summaries, tags, emails, match reasons) must be in Hebrew
- `null` is a valid response from `extractLeadFromPost` — post is not a real estate lead

### Cost Estimates
| Action | Tokens | Cost (Sonnet) |
|---|---|---|
| Score 1 lead | ~500 | ~$0.002 |
| Extract from 1 post | ~300 | ~$0.001 |
| Match 10 leads to 1 property | ~400 | ~$0.002 |
| Run discovery (15 posts) | ~5,000 | ~$0.02 |
| Generate email | ~200 | ~$0.001 |

---

## 🕷 Lead Discovery Engine

### Architecture
```
discovery/page.tsx
  └─ POST /api/crawl { sources[], keyword, manualPosts[] }
       ├─ manual posts → always processed first, no limit
       ├─ GET /api/telegram → MTProto channel history (or t.me/s/ preview fallback)
       ├─ GET /api/yad2?city=… → city-scoped listings (local only)
       └─ Claude extraction loop (cap: manual + 15 crawler posts per run)
            └─ Returns { scanned, extracted, leads[] }

User → clicks "+ הוסף ל-CRM" → createLead() → Supabase → addLead(store)
```

### Sources
| Source | Key | Auth | Limit | Notes |
|---|---|---|---|---|
| Manual paste | `manual` | None | Unlimited | Always processed; paste any text from any platform |
| Telegram | `telegram` | MTProto (optional) | 30 msgs/channel | MTProto user session reads public channel history; **works on Vercel**. Falls back to t.me/s/ HTML preview (local only) when not configured. |
| Yad2 | `yad2` | None | feed page | City-scoped via `?city=` param. **Local only** — Cloudflare-blocked on datacenter IPs. |
| Madlan | `madlan` | None | — | **Local only** — PerimeterX CAPTCHA blocks all automation. |

> **Reddit was removed** (account-level ban on the operator's Reddit account + Reddit closed its public `.json` API to unauthenticated requests). The `/api/reddit` route, discovery source, settings card, and debug test were all deleted.

### Telegram MTProto (the free, Vercel-capable source)
The Bot API can't read channels the bot hasn't joined, so lead discovery uses a
**user-account MTProto session** via GramJS (`telegram` npm package):
- `lib/telegram-client.ts` — `getTelegramClient()` (module-cached while warm) + `telegramConfigured()`
- `api/telegram/route.ts` — MTProto path first; falls back to the public t.me/s/ HTML preview when env vars are missing or MTProto returns 0
- One-time login: `npm run telegram:login` (`scripts/telegram-login.mjs`) — prompts for phone + code, prints `TELEGRAM_SESSION`
- Channels: `menivimnet`, `jeremy_public`, `israelrealestate`, `nadlan_il`, `realestate_israel`
- **Not** in `serverExternalPackages` — Turbopack bundles it (the `telegram/sessions` subpath can't be externalized)

### Keyword Intent Filter
Crawler posts (non-manual) must match ≥1 keyword before being sent to Claude
(saves API costs) — except `yad2`/`madlan`/`telegram`, which are
structurally filtered post-extraction via `matchesExtractedLead()` instead:
```
EN: looking for apartment, looking to buy/rent, need apartment, for rent, for sale,
    relocating to, moving to israel, apartment available, want to buy, flat in israel,
    room for rent, studio for rent, sell my apartment, invest in israel, property for sale

HE: מחפש דירה, מחפשת דירה, מוכר דירה, דירה למכירה, דירה להשכרה,
    רוצה לקנות, מעוניין בדירה
```

### Claude Extraction Prompt (crawl route)
Instructs Claude to return JSON or `null`. Key fields extracted:
`intent_type, city (Hebrew), neighborhood (Hebrew), budget_min, budget_max, rooms, property_type, ai_score, urgency_score, ai_summary (Hebrew), tags[], source_platform`

### Processing Cap
- Manual posts: all processed (no cap)
- Crawler posts: max 15 per run (prevents runaway API costs)
- Deduplication: fingerprint = first 60 chars of post text

---

## 🌐 Environment Variables

```bash
# ── Required ──────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# ── Required for all AI features ──────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...
# ⚠️ NO NEXT_PUBLIC_ prefix — server-side only
# ⚠️ Used only in app/api/ai/route.ts and app/api/crawl/route.ts

# ── Required for Discovery crawler internal calls ─────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Change to https://yourdomain.com in production
# Used in /api/crawl to call /api/telegram, /api/yad2, /api/madlan internally

# ── Telegram MTProto (lead discovery — works on Vercel) ───────
TELEGRAM_API_ID=1234567        # from https://my.telegram.org
TELEGRAM_API_HASH=abc123...    # from https://my.telegram.org
TELEGRAM_SESSION=1Ab...        # generated by `npm run telegram:login`
# All three required for MTProto. Without them, /api/telegram falls back to the
# public t.me/s/ HTML preview (works locally, blocked on Vercel datacenter IPs).
# TELEGRAM_SESSION grants full access to the logged-in Telegram account — secret.

# Note: Google Custom Search JSON API was dropped as a source — Google closed
# it to new customers in early 2026, returning a permanent 403 on any newly
# created project/key/search-engine combination (not fixable via configuration).
#
# Note: Apify was removed entirely (was a paid fallback for Yad2/Madlan/Telegram/
# Reddit). No paid scraping service is used. Yad2/Madlan are marked "local only"
# in the discovery UI — they work from a residential IP (local `npm run dev`)
# but are blocked by Cloudflare/PerimeterX on cloud/datacenter IPs like Vercel's.
```

---

## 🎨 UI & Design System

### Theme
- **Dark only** — no light mode toggle
- Background layers: `bg-slate-950` (page) → `bg-slate-900` (sidebar, topbar) → `bg-slate-800` (inputs, cards inner)
- **Glass card** = `.glass` class: `background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(8px)`
- **RTL**: every page wrapper has `dir="rtl"`. Topbar search input has `dir="rtl"` too.
- Accent: `#6366f1` (indigo-500) / `#a855f7` (purple-500)
- Border: `rgba(255,255,255,0.06)` (white/6) — never hard grey

### Color System
| Token | Hex | Usage |
|---|---|---|
| Buyer intent | `#6366f1` | badges, avatars |
| Seller intent | `#22c55e` | badges, avatars |
| Renter intent | `#f59e0b` | badges, avatars |
| Investor intent | `#a855f7` | badges, avatars |
| Score hot (≥80) | `#22c55e` | score bars, text |
| Score warm (60–79) | `#f59e0b` | score bars, text |
| Score cold (<60) | `#64748b` | score bars, text |

> Note: `intentColor()` in `utils.ts` returns `#4f6ef7` for buyer (slightly different shade than `#6366f1` used in Tailwind classes). Use `intentColor()` for inline styles, Tailwind `indigo-500` for class-based.

### Shared UI Components (`components/ui/index.tsx`)
| Component | Props | Notes |
|---|---|---|
| `IntentBadge` | `{ intent }` | colored pill: קונה/מוכר/שוכר/משקיע |
| `StatusBadge` | `{ status }` | colored pill: all lead + property statuses |
| `ScoreBar` | `{ score, showLabel? }` | colored progress bar + optional numeric label |
| `Avatar` | `{ name, color?, size? }` | initials circle; size: sm/md/lg |
| `StatCard` | `{ icon, label, value, sub?, color? }` | dashboard stat tile |
| `AIBox` | `{ title, children }` | indigo-tinted AI insight container |
| `Spinner` | none | centered loading spinner |
| `EmptyState` | `{ icon, title, desc }` | centered empty state with emoji |
| `SectionTitle` | `{ children }` | uppercase small label with bottom border |

**Always use these.** Never create inline badge or score bar styles in page files.

---

## 🔄 State Management (Zustand)

### Store: `useCRMStore()` from `store/crm.ts`

#### State slices
```ts
// Data
leads: Lead[]
properties: Property[]
agents: Agent[]
notifications: Notification[]

// Selection
selectedLead: Lead | null         // setting this also sets detailPanelOpen = true
selectedProperty: Property | null

// Filters
filters: LeadFilters              // { intent_type, city, status, min_score, source_platform, search }
searchQuery: string               // global search from Topbar input

// UI
sidebarOpen: boolean
detailPanelOpen: boolean

// Loading
leadsLoading: boolean
propertiesLoading: boolean
```

#### Actions
```ts
setLeads(leads)             setProperties(p)     setAgents(a)        setNotifications(n)
setSelectedLead(lead)       // ← also opens detail panel
setSelectedProperty(p)
setFilters(f)               setSearchQuery(q)
setLeadsLoading(bool)       setPropertiesLoading(bool)
addLead(lead)               // prepends to leads[]
updateLead(id, updates)     // updates leads[] + selectedLead if same id
removeLead(id)              // removes + clears selectedLead if same id
markNotificationRead(id)    // sets is_read = true in notifications[]
unreadCount()               // derived: notifications.filter(n => !n.is_read).length
```

#### Data Flow
```
Page mounts
  → fetch from Supabase (lib/*.ts)
  → setLeads / setProperties (store)
  → components read from store via useCRMStore()

User action (status change, delete)
  → optimistic: updateLead / removeLead in store (instant UI)
  → async: updateLead / deleteLead in Supabase
  → on error: could rollback (not yet implemented — add if needed)
```

---

## 📐 TypeScript Types (`types/index.ts`)

### Union types (use these, not raw strings)
```ts
type IntentType    = 'buyer' | 'seller' | 'renter' | 'investor'
type LeadStatus    = 'new' | 'contacted' | 'qualified' | 'negotiating' | 'won' | 'lost'
type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented'
type AgentRole     = 'admin' | 'senior_agent' | 'agent' | 'junior_agent'
type PropertyType  = 'apartment' | 'villa' | 'penthouse' | 'studio' | 'commercial' | 'land'
```

### Key interfaces
`Lead`, `Property`, `Agent`, `Notification`, `Activity`, `LeadPropertyMatch`, `SavedSearch`, `LeadFilters`, `DashboardStats`, `CrawlerSource`, `AIMatchResult`

All defined in `types/index.ts`. Never redefine inline in components.

---

## 📋 Key Patterns & Recipes

### Add a new CRM page
```tsx
// app/<name>/page.tsx
'use client'
import CRMLayout from '@/components/layout/CRMLayout'
import Topbar from '@/components/layout/Topbar'
import { useCRMStore } from '@/store/crm'

export default function NewPage() {
  const { leads } = useCRMStore()
  return (
    <CRMLayout>
      <Topbar title="כותרת" action={{ label: 'פעולה', onClick: () => {} }} />
      <div className="flex-1 overflow-y-auto p-5" dir="rtl">
        {/* content */}
      </div>
    </CRMLayout>
  )
}
```
Then add nav item to `components/layout/Sidebar.tsx` `navItems` array.

### Add a new AI feature
```ts
// 1. lib/ai.ts — add function using internal callClaude()
export async function myNewFeature(input: string): Promise<Result> {
  const raw = await callClaude(systemPrompt, userPrompt)
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return fallback  // Hebrew fallback
  }
}

// 2. Component calls lib/ai.ts function directly (never fetch /api/ai directly)
const result = await myNewFeature(input)
```

### Add a new lead data source
```ts
// 1. app/api/<source>/route.ts — GET handler returning { posts: [...] }
// 2. app/api/crawl/route.ts — add fetch block under // ── <Source> ──
// 3. discovery/page.tsx — add to SOURCE_CONFIG array:
{ key: 'mysource', label: 'שם', emoji: '🔧', desc: 'תיאור', free: true }
```

### Safe Supabase schema change
```sql
-- Always safe to run multiple times:
alter table leads add column if not exists new_col text;
drop policy if exists "Allow all for authenticated" on leads;
create policy "Allow all for authenticated" on leads
  for all using (auth.role() = 'authenticated');
```

### Format currency
```ts
fmt(3500000)         // → "₪3.5M"
fmt(500000)          // → "₪500K"
fmt(9000, true)      // → "₪9,000/חודש"  (rental)
fmt(null)            // → "—"
```

---

## ⚠️ Known Issues & Resolved Bugs

| Error | Root Cause | Status | Fix |
|---|---|---|---|
| All pages 404 | Added `src/` folder to project | ✅ Resolved | Remove `src/`, keep flat structure with `@/* → ./` |
| `invalid next.config.js: Unrecognized key appDir` | `experimental: { appDir: true }` in config | ✅ Resolved | Use empty `const nextConfig = {}` |
| `column "neighborhood" does not exist` | Properties table pre-dates new schema | ✅ Resolved | Run `supabase/fix_properties.sql` |
| `column "rooms" does not exist` | Same | ✅ Resolved | Same |
| `invalid input value for enum property_status` | Original schema used PostgreSQL enum | ✅ Resolved | `fix_properties.sql` drops enum, recreates as text |
| `policy "Allow all for authenticated" already exists` | Re-running SQL without drop | ✅ Resolved | Always `DROP POLICY IF EXISTS` before `CREATE POLICY` |
| `column "name" does not exist` (leads) | Tried to migrate non-existent column | ✅ Resolved | `fix_leads_v2.sql` skips name migration |
| `relationship between leads and agents not found` | Table is `agencies` not `agents` | ✅ Resolved | `leads.ts` uses `select('*')` (no join), agents page tries both tables |
| `400 Bad Request` on leads query | `select('*,agent:agents(...)')` failed | ✅ Resolved | Removed agent join entirely |
| AI calls blocked by browser CORS | Calling Anthropic directly from client | ✅ Resolved | All calls go through `/api/ai` server route |
| Discovery manual paste ignored | Not processed when another source also selected | ✅ Resolved | `/api/crawl` always processes manual posts first, unconditionally |
| Yad2/Madlan return 0 posts on Vercel | Sites block cloud/datacenter IPs (Cloudflare/PerimeterX) | ⚠️ Known limit | No free workaround. Yad2/Madlan marked "local only" (work via `npm run dev` on a residential IP). Telegram MTProto is the free source that works on Vercel. |
| Reddit dropped entirely | Operator's Reddit account permanently suspended + Reddit closed its public `.json` API to unauthenticated requests (403 for everyone) | ❌ Removed | `/api/reddit` route, discovery source, settings card, and debug test all deleted; replaced by Telegram MTProto |
| Google Search dropped entirely | Google closed Custom Search JSON API to new customers (2026) — permanent 403 on any new project/key/cx, unfixable | ❌ Removed | Source deleted from discovery page, `/api/crawl`, and `/api/google-search` route |
| `next lint` errors "Invalid project directory ... /lint" | Next.js 16 removed the `next lint` subcommand | ⚠️ Known | `npm run lint` is broken until migrated to ESLint flat config (`eslint.config.mjs`). The `next build` TypeScript check is the working gate. |

---

## 🧪 Testing Checklist

### Discovery — Manual Paste
1. Go to `/discovery`
2. Check ✅ **הדבקה ידנית**, select **פייסבוק**
3. Paste: `"מחפש דירת 3-4 חדרים לקנייה בתל אביב, תקציב עד 4 מיליון, צריך תוך 3 חודשים"`
4. Click **הפעל סריקה** → wait ~10s
5. ✅ Expected: card with `intent=buyer`, `city=תל אביב`, `budget=4M`, Hebrew summary

### Discovery — Telegram
1. (One-time) Set `TELEGRAM_API_ID`/`TELEGRAM_API_HASH`, run `npm run telegram:login`, paste `TELEGRAM_SESSION` into env
2. Check ✅ **טלגרם** only
3. Click **הפעל סריקה** → wait ~25s
4. Check **לוג פעילות**: should show `telegram: using MTProto` + per-channel `@channel: N raw → M added`
5. Without MTProto env vars: falls back to t.me/s/ preview (works locally, 0 on Vercel)

### Leads Page
1. Table renders with filters (intent, status, city, sort)
2. Click a row → LeadDetailPanel slides in from right
3. Status buttons in panel update Supabase and close panel correctly

### Add Lead Modal
1. Click **ליד חדש** → fill form → Save
2. AI scoring runs (~5s) → lead appears in table with ai_score populated
3. Check Supabase `leads` table — row exists with all AI fields

### Debug Checklist
- [ ] F12 console — any red errors?
- [ ] **לוג פעילות** in discovery page bottom
- [ ] `.env.local` has `NEXT_PUBLIC_APP_URL` (for internal crawl API calls)
- [ ] `ANTHROPIC_API_KEY` has no `NEXT_PUBLIC_` prefix
- [ ] `npm run build` passes clean (catches type errors before deploy)

---

## Commands

```bash
npm install          # install / update dependencies
npm run dev          # dev server → http://localhost:3000
npm run build        # production build (run before every PR)
npm run lint         # ESLint check (run before every PR)
```