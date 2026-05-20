-- Supabase schema for Nha Dat Viet MVP.
-- Run this in Supabase SQL Editor, then fill data/supabase-config.json.

create extension if not exists postgis;

create table if not exists public.listings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  location geography(point, 4326),
  status text not null default 'PUBLIC',
  member_id text,
  source_submission_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_location_gix on public.listings using gist (location);
create index if not exists listings_data_gin on public.listings using gin (data);
create index if not exists listings_status_idx on public.listings (status);

create table if not exists public.submissions (
  id text primary key,
  tracking_code text unique,
  member_id text,
  contact jsonb not null default '{}'::jsonb,
  listing jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING',
  review_note text,
  listing_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists submissions_member_idx on public.submissions (member_id);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_contact_gin on public.submissions using gin (contact);

create table if not exists public.leads (
  id text primary key,
  listing_id text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'NEW',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_listing_idx on public.leads (listing_id);
create index if not exists leads_data_gin on public.leads using gin (data);

create table if not exists public.events (
  id bigserial primary key,
  type text not null,
  listing_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_listing_idx on public.events (listing_id);
create index if not exists events_type_idx on public.events (type);

create table if not exists public.site_settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.road_prices (
  id bigserial primary key,
  name text not null,
  display_name text,
  area text,
  price_million_per_m2 numeric not null,
  aliases text[] default '{}',
  position1_factor numeric default 1,
  alley_factor numeric default 0.7,
  updated_at timestamptz not null default now()
);

alter table public.listings enable row level security;
alter table public.submissions enable row level security;
alter table public.leads enable row level security;
alter table public.events enable row level security;
alter table public.site_settings enable row level security;
alter table public.road_prices enable row level security;

-- MVP policies for anon key. Restrict later when auth is added.
drop policy if exists "public read listings" on public.listings;
create policy "public read listings" on public.listings for select using (status = 'PUBLIC');

drop policy if exists "public insert submissions" on public.submissions;
create policy "public insert submissions" on public.submissions for insert with check (true);

drop policy if exists "member read own submissions by anon" on public.submissions;
create policy "member read own submissions by anon" on public.submissions for select using (true);

drop policy if exists "member update pending submissions by anon" on public.submissions;
create policy "member update pending submissions by anon" on public.submissions for update using (status = 'PENDING') with check (status = 'PENDING');

drop policy if exists "public insert leads" on public.leads;
create policy "public insert leads" on public.leads for insert with check (true);

drop policy if exists "public insert events" on public.events;
create policy "public insert events" on public.events for insert with check (true);

drop policy if exists "public read site" on public.site_settings;
create policy "public read site" on public.site_settings for select using (true);

drop policy if exists "public read road prices" on public.road_prices;
create policy "public read road prices" on public.road_prices for select using (true);

-- Temporary admin policies for static admin MVP. Replace with real Supabase Auth before public scale.
drop policy if exists "temporary admin all listings" on public.listings;
create policy "temporary admin all listings" on public.listings for all using (true) with check (true);

drop policy if exists "temporary admin all leads" on public.leads;
create policy "temporary admin all leads" on public.leads for all using (true) with check (true);

drop policy if exists "temporary admin all submissions" on public.submissions;
create policy "temporary admin all submissions" on public.submissions for all using (true) with check (true);

drop policy if exists "temporary admin all site" on public.site_settings;
create policy "temporary admin all site" on public.site_settings for all using (true) with check (true);
