-- ============================================================
-- PropFlow CRM — Full Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── AGENTS ──────────────────────────────────────────────────
create table if not exists agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  phone text,
  role text default 'agent' check (role in ('admin','senior_agent','agent','junior_agent')),
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── LEADS ───────────────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  -- Identity
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  -- Discovery
  source_platform text default 'manual',
  original_post text,
  source_url text,
  -- Intent
  intent_type text default 'buyer' check (intent_type in ('buyer','seller','renter','investor')),
  -- Location
  city text,
  neighborhood text,
  -- Budget
  budget_min numeric,
  budget_max numeric,
  -- Property preference
  rooms integer,
  property_type text default 'apartment',
  -- AI fields
  urgency_score integer default 50 check (urgency_score between 0 and 100),
  ai_score integer default 50 check (ai_score between 0 and 100),
  ai_summary text,
  ai_follow_up text,
  -- CRM fields
  status text default 'new' check (status in ('new','contacted','qualified','negotiating','won','lost')),
  tags text[] default '{}',
  notes text,
  assigned_agent_id uuid references agents(id) on delete set null,
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Keep legacy lead_score column working
alter table leads add column if not exists lead_score integer default 50;

-- ─── PROPERTIES ──────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  address text,
  city text,
  neighborhood text,
  rooms integer,
  area numeric,
  floor integer,
  total_floors integer,
  price numeric,
  is_rental boolean default false,
  property_type text default 'apartment',
  status text default 'available' check (status in ('available','reserved','sold','rented')),
  description text,
  images text[] default '{}',
  owner_name text,
  owner_phone text,
  listing_source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── LEAD ↔ PROPERTY MATCHES ─────────────────────────────────
create table if not exists lead_property_matches (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  match_score integer check (match_score between 0 and 100),
  match_reason text,
  created_at timestamptz default now(),
  unique(lead_id, property_id)
);

-- ─── ACTIVITIES / AUDIT LOG ──────────────────────────────────
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  type text not null, -- 'note','call','email','status_change','match','discovery'
  content text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete cascade,
  type text not null, -- 'hot_lead','match','seller','crawler','system'
  title text not null,
  body text,
  lead_id uuid references leads(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ─── SAVED SEARCHES ───────────────────────────────────────────
create table if not exists saved_searches (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references agents(id) on delete cascade,
  name text not null,
  filters jsonb default '{}',
  alert_enabled boolean default false,
  created_at timestamptz default now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger leads_updated_at before update on leads
  for each row execute function update_updated_at();
create trigger properties_updated_at before update on properties
  for each row execute function update_updated_at();

-- ─── RLS (Row Level Security) ────────────────────────────────
alter table leads enable row level security;
alter table properties enable row level security;
alter table agents enable row level security;
alter table activities enable row level security;
alter table notifications enable row level security;

-- For now allow all authenticated users (tighten per role later)
create policy "Allow all for authenticated" on leads for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on properties for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on agents for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on activities for all using (auth.role() = 'authenticated');
create policy "Allow all for authenticated" on notifications for all using (auth.role() = 'authenticated');

-- ─── SEED DATA ───────────────────────────────────────────────
insert into agents (name, email, phone, role) values
  ('דנה לוי', 'dana@propflow.co.il', '050-111-2222', 'senior_agent'),
  ('יואב בן', 'yoav@propflow.co.il', '052-333-4444', 'agent'),
  ('שירה טל', 'shira@propflow.co.il', '054-555-6666', 'senior_agent'),
  ('עידו אברהם', 'ido@propflow.co.il', '058-777-8888', 'junior_agent')
on conflict do nothing;

insert into properties (title, address, city, neighborhood, rooms, area, price, is_rental, property_type, status, owner_name) values
  ('4 חדרים מודרני בפלורנטין', 'הרצל 45', 'תל אביב', 'פלורנטין', 4, 120, 3200000, false, 'apartment', 'available', 'פרטי'),
  ('פנטהאוז נוף ים יוקרתי', 'הירקון 180', 'תל אביב', 'צפון ת"א', 5, 220, 8500000, false, 'penthouse', 'available', 'סוכנות'),
  ('וילה משפחתית עם גינה', 'הרים 12', 'רעננה', 'מרכז', 5, 280, 3900000, false, 'villa', 'available', 'פרטי'),
  ('סטודיו בוהמייני ברחביה', 'רמבן 8', 'ירושלים', 'רחביה', 1, 45, 9000, true, 'studio', 'available', 'סוכנות'),
  ('3 חדרים כרמל סנטר', 'מוריה 22', 'חיפה', 'כרמל', 3, 95, 1900000, false, 'apartment', 'reserved', 'פרטי'),
  ('3 חדרים שדרות רוטשילד', 'רוטשילד 88', 'תל אביב', 'רוטשילד', 3, 140, 5500000, false, 'apartment', 'available', 'סוכנות')
on conflict do nothing;
