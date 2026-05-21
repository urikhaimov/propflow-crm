-- ─── Add all missing columns to leads table ──────────────────
alter table leads add column if not exists first_name text default '';
alter table leads add column if not exists last_name text default '';
alter table leads add column if not exists source_platform text default 'manual';
alter table leads add column if not exists original_post text;
alter table leads add column if not exists source_url text;
alter table leads add column if not exists intent_type text default 'buyer';
alter table leads add column if not exists city text;
alter table leads add column if not exists neighborhood text;
alter table leads add column if not exists budget_min numeric;
alter table leads add column if not exists budget_max numeric;
alter table leads add column if not exists rooms integer;
alter table leads add column if not exists property_type text default 'apartment';
alter table leads add column if not exists urgency_score integer default 50;
alter table leads add column if not exists ai_score integer default 50;
alter table leads add column if not exists ai_summary text;
alter table leads add column if not exists ai_follow_up text;
alter table leads add column if not exists tags text[] default '{}';
alter table leads add column if not exists assigned_agent_id uuid;
alter table leads add column if not exists updated_at timestamptz default now();

-- Map old columns if they exist
update leads set source_platform = source   where source_platform = 'manual' and source is not null;
update leads set ai_score        = lead_score where ai_score = 50  and lead_score is not null;
update leads set budget_max      = budget    where budget_max is null and budget is not null;

-- Fix status enum → text if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'status'
    AND udt_name NOT IN ('text','varchar')
  ) THEN
    ALTER TABLE leads ADD COLUMN status_text text;
    UPDATE leads SET status_text = status::text;
    ALTER TABLE leads DROP COLUMN status;
    ALTER TABLE leads RENAME COLUMN status_text TO status;
    ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'new';
  END IF;
END $$;

-- ─── Seed sample leads ────────────────────────────────────────
insert into leads (first_name, last_name, email, phone, intent_type, city, neighborhood, budget_min, budget_max, rooms, property_type, source_platform, urgency_score, ai_score, status, tags, original_post) values
  ('עומר','שפירו','omer@gmail.com','050-123-4567','buyer','תל אביב','פלורנטין',2000000,3500000,4,'apartment','facebook',92,88,'new',ARRAY['משפחה','דחוף'],'מחפש דירת 4 חדרים בפלורנטין, תקציב עד 3.5M'),
  ('נועה','כהן','noa@walla.co.il','052-987-6543','seller','חיפה','כרמל',1800000,1800000,3,'apartment','yad2',75,81,'contacted',ARRAY['מוטיבציה'],'מוכרת 3 חדרים בכרמל, 1.8M, גמישה במחיר'),
  ('אבי','מזרחי','avi@business.com','054-111-2222','investor','תל אביב','רמת אביב',5000000,10000000,5,'penthouse','linkedin',60,94,'qualified',ARRAY['משקיע','פורטפוליו'],'מעוניין להרחיב פורטפוליו נדלן בת"א'),
  ('רוני','פרץ','roni@hotmail.com','058-333-4444','renter','ירושלים','רחביה',7000,12000,2,'apartment','telegram',88,72,'new',ARRAY['סטודנט','דחוף'],'צריך 2 חדרים ברחביה מיולי, עד 12K לחודש'),
  ('מאיה','פרידמן','maya@gmail.com','050-555-6666','buyer','רעננה','מרכז',3000000,4000000,5,'villa','reddit',45,65,'contacted',ARRAY['משפחה','גינה'],'מחפשים 5 חדרים עם גינה ברעננה ~4M'),
  ('טל','גולדשטיין','tal@startup.io','052-777-8888','buyer','תל אביב','רוטשילד',4000000,6000000,3,'apartment','twitter',70,85,'qualified',ARRAY['טכנולוגיה'],'מוכן לקנות בת"א, רוטשילד 3 חדרים עד 6M')
on conflict do nothing;
