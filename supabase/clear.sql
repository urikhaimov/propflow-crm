-- ─── Safe clear — only truncates tables that exist ───────────
do $$
begin
  if exists (select from pg_tables where tablename = 'lead_property_matches') then
    truncate table lead_property_matches cascade;
  end if;
  if exists (select from pg_tables where tablename = 'notifications') then
    truncate table notifications cascade;
  end if;
  if exists (select from pg_tables where tablename = 'activities') then
    truncate table activities cascade;
  end if;
  if exists (select from pg_tables where tablename = 'saved_searches') then
    truncate table saved_searches cascade;
  end if;
  if exists (select from pg_tables where tablename = 'leads') then
    truncate table leads cascade;
  end if;
  if exists (select from pg_tables where tablename = 'properties') then
    truncate table properties cascade;
  end if;
end $$;

-- Show what tables exist and their counts
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by table_name;