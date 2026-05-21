-- ─── Drop and recreate properties table cleanly ──────────────
DROP TABLE IF EXISTS lead_property_matches CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

-- Drop the old enum type if it exists
DROP TYPE IF EXISTS property_status CASCADE;
DROP TYPE IF EXISTS property_type_enum CASCADE;

-- Recreate as plain text columns (no enums)
CREATE TABLE properties (
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
  status text default 'available',
  description text,
  images text[] default '{}',
  owner_name text,
  owner_phone text,
  listing_source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recreate matches table
CREATE TABLE lead_property_matches (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  property_id uuid references properties(id) on delete cascade,
  match_score integer check (match_score between 0 and 100),
  match_reason text,
  created_at timestamptz default now(),
  unique(lead_id, property_id)
);

-- RLS
alter table properties enable row level security;
create policy "Allow all for authenticated" on properties
  for all using (auth.role() = 'authenticated');

-- Seed
insert into properties (title, address, city, neighborhood, rooms, area, price, is_rental, property_type, status, owner_name) values
  ('4 חדרים מודרני בפלורנטין', 'הרצל 45', 'תל אביב', 'פלורנטין', 4, 120, 3200000, false, 'apartment', 'available', 'פרטי'),
  ('פנטהאוז נוף ים יוקרתי', 'הירקון 180', 'תל אביב', 'צפון ת"א', 5, 220, 8500000, false, 'penthouse', 'available', 'סוכנות'),
  ('וילה משפחתית עם גינה', 'הרים 12', 'רעננה', 'מרכז', 5, 280, 3900000, false, 'villa', 'available', 'פרטי'),
  ('סטודיו ברחביה', 'רמבן 8', 'ירושלים', 'רחביה', 1, 45, 9000, true, 'studio', 'available', 'סוכנות'),
  ('3 חדרים כרמל סנטר', 'מוריה 22', 'חיפה', 'כרמל', 3, 95, 1900000, false, 'apartment', 'available', 'פרטי'),
  ('3 חדרים רוטשילד', 'רוטשילד 88', 'תל אביב', 'רוטשילד', 3, 140, 5500000, false, 'apartment', 'available', 'סוכנות');
