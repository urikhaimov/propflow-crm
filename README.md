# 🏠 PropFlow CRM — AI Real Estate Lead Engine

A production-ready AI-powered CRM for real estate agencies. Built with Next.js, Supabase, Zustand, and Anthropic Claude AI.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | Stats, charts, heatmap, hot leads |
| 👥 **Leads** | Full table, filters, AI scores, detail panel |
| ⚡ **Pipeline** | Kanban board across 6 stages |
| 🏢 **Properties** | Property cards with AI match count |
| 🤖 **AI Discovery** | Crawler simulation + Claude AI extraction from posts |
| 🎯 **AI Matching** | Buyers ↔ Properties with AI explanation |
| 🔍 **Smart Search** | Natural language search via Claude AI |
| 👤 **Agents** | Performance stats and role management |
| 🔔 **Notifications** | Hot lead alerts, match alerts, crawler updates |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and Anthropic API key
```

### 3. Set up Supabase database
- Go to [supabase.com](https://supabase.com) and create a project
- Open the SQL Editor
- Copy and run the full contents of `supabase/schema.sql`
- This creates all tables, RLS policies, triggers, and seeds sample data

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
propflow-crm/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Main dashboard
│   │   ├── leads/              # Leads table + detail panel
│   │   ├── pipeline/           # Kanban board
│   │   ├── properties/         # Property cards
│   │   ├── discovery/          # AI Lead Discovery crawler
│   │   ├── matching/           # AI Matching Engine
│   │   ├── search/             # Smart AI Search
│   │   ├── agents/             # Agent management
│   │   ├── notifications/      # Alerts & notifications
│   │   ├── layout.tsx          # Root layout (RTL Hebrew)
│   │   ├── page.tsx            # Redirects to /dashboard
│   │   └── globals.css         # Global dark theme styles
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   │   ├── Topbar.tsx      # Page header + search
│   │   │   └── CRMLayout.tsx   # Layout wrapper
│   │   ├── ui/
│   │   │   └── index.tsx       # Badge, ScoreBar, StatCard, AIBox…
│   │   └── leads/
│   │       ├── LeadDetailPanel.tsx  # Slide-in lead detail
│   │       └── AddLeadModal.tsx     # Add lead form + AI scoring
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── leads.ts            # Lead CRUD + stats
│   │   ├── properties.ts       # Property CRUD
│   │   ├── ai.ts               # All Claude AI features
│   │   └── utils.ts            # Formatting, colors, helpers
│   ├── store/
│   │   └── crm.ts              # Zustand global store
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── supabase/
│   └── schema.sql              # Full DB schema + seed data
├── .env.example                # Environment variable template
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## 🤖 AI Features (powered by Claude)

### Lead Scoring (`lib/ai.ts → scoreLeadWithAI`)
When you add a new lead, Claude automatically:
- Assigns an **AI score** (0–100) based on intent clarity, budget, urgency
- Assigns an **urgency score** based on temporal cues in the original post
- Generates a **Hebrew summary** of the lead
- Generates a **personalized follow-up message** in Hebrew
- Suggests **tags** for categorization

### Lead Extraction (`extractLeadFromPost`)
Paste any social media post and Claude extracts:
- Intent type, city, budget, rooms, property type

### AI Matching (`matchLeadsToProperty`)
Given a property and a list of leads, Claude:
- Scores compatibility (0–100)
- Explains the match in Hebrew

### Smart Search (`aiSearchLeads`)
Natural language query → Claude filters leads semantically

### Email Generation (`generateEmail`)
One click → Claude generates a personalized Hebrew email to the lead

---

## 🗄️ Database Schema

| Table | Purpose |
|---|---|
| `leads` | All lead data with AI scores |
| `properties` | Property listings |
| `agents` | Agent profiles and roles |
| `lead_property_matches` | AI match results |
| `activities` | Audit log of all actions |
| `notifications` | Agent alerts |
| `saved_searches` | Saved search filters |

---

## 🔧 Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **State**: Zustand
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime)
- **AI**: Anthropic Claude (`claude-sonnet-4-20250514`)
- **UI**: Custom dark theme, RTL Hebrew support

---

## 📝 Notes

- The app is fully RTL (Hebrew) by default
- All AI calls go through `lib/ai.ts` — swap the model or add web search tools there
- The Supabase schema includes RLS policies — adjust per your auth setup
- Mock data is used for notifications and weekly chart when no real data exists
- The Anthropic API key is handled automatically in claude.ai — for your own deployment add it to `.env.local`
