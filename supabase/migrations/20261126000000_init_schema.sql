-- SmartPack initial schema
-- pgvector + profiles + health docs + embeddings + knowledge base + scans + daily intake

create extension if not exists vector with schema extensions;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  full_name      text not null,
  dob            date not null,
  gender         text check (gender in ('male','female','other')),
  height_cm      numeric(5,1) not null check (height_cm between 50 and 250),
  weight_kg      numeric(5,1) not null check (weight_kg between 10 and 300),
  activity_level text not null default 'moderate'
                 check (activity_level in ('sedentary','light','moderate','active','very_active')),
  conditions     text[] not null default '{}',   -- diabetes, cholesterol, hypertension, thyroid, pcos ...
  allergies      text[] not null default '{}',   -- peanut, gluten, lactose ...
  diet_prefs     text[] not null default '{}',   -- vegetarian, vegan, jain ...
  goals          text[] not null default '{}',   -- sugar_cut, calorie_deficit, muscle_gain, keto ...
  health_text    text not null,                  -- free-text description (required)
  -- derived by the process-profile function
  bmi            numeric(4,1),
  bmr_kcal       integer,
  daily_kcal     integer,
  rulebook       jsonb,                          -- personal limits: {sugar_g_max, sodium_mg_max, avoid:[...]}
  processing_status text not null default 'pending'
                 check (processing_status in ('pending','processing','ready','failed')),
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ───────────────────── health documents ─────────────────────
create table public.health_documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  file_path      text not null,                  -- path inside the 'health-docs' bucket
  file_name      text,
  mime_type      text,
  extracted_json jsonb,                          -- {hba1c, ldl, fasting_glucose, ...}
  status         text not null default 'uploaded'
                 check (status in ('uploaded','processing','done','failed')),
  created_at     timestamptz not null default now()
);
create index on public.health_documents (user_id);

-- ─────────────────── per-user profile vectors ───────────────────
create table public.profile_embeddings (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  source      text not null check (source in ('profile','health_text','report','rulebook')),
  chunk_text  text not null,
  embedding   extensions.vector(768) not null,
  created_at  timestamptz not null default now()
);
create index on public.profile_embeddings (user_id);
create index on public.profile_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- ─────────────── shared guideline knowledge base ───────────────
create table public.knowledge_chunks (
  id          bigserial primary key,
  source      text not null,                     -- FSSAI, ICMR-NIN, WHO, ADA ...
  topic       text,                              -- sugar, sodium, trans_fat, additives ...
  chunk_text  text not null,
  embedding   extensions.vector(768) not null,
  created_at  timestamptz not null default now()
);
create index on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ─────────────── ingredient alias dictionary ───────────────
create table public.ingredient_aliases (
  id          bigserial primary key,
  alias       text not null unique,              -- lowercase: 'maltodextrin', 'e621', 'invert syrup'
  canonical   text not null,                     -- 'sugar', 'msg', 'palm_oil', 'trans_fat' ...
  category    text not null,                     -- hidden_sugar, fat, additive, allergen, sodium
  risk_level  text not null default 'medium' check (risk_level in ('low','medium','high')),
  explanation text not null                      -- plain-language explanation
);

-- ───────────────────────── scans ─────────────────────────
create table public.scans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  image_path    text,
  product_name  text,
  label_json    jsonb not null,                  -- structured extraction from the label
  engine_json   jsonb,                           -- deterministic flags (aliases, dates, calories)
  verdict_json  jsonb,                           -- final personalized verdict
  verdict       text check (verdict in ('SAFE','LIMIT','AVOID')),
  score         integer check (score between 0 and 100),
  created_at    timestamptz not null default now()
);
create index on public.scans (user_id, created_at desc);

-- ─────────────────────── daily intake ───────────────────────
create table public.daily_intake (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scan_id     uuid references public.scans(id) on delete set null,
  day         date not null default current_date,
  servings    numeric(4,2) not null default 1,
  calories    numeric(7,1) not null default 0,
  sugar_g     numeric(6,1) not null default 0,
  sodium_mg   numeric(7,1) not null default 0,
  fat_g       numeric(6,1) not null default 0,
  sat_fat_g   numeric(6,1) not null default 0,
  protein_g   numeric(6,1) not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.daily_intake (user_id, day);

-- ───────────────────── updated_at trigger ─────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- ───────────────────── row level security ─────────────────────
alter table public.profiles           enable row level security;
alter table public.health_documents   enable row level security;
alter table public.profile_embeddings enable row level security;
alter table public.knowledge_chunks   enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.scans              enable row level security;
alter table public.daily_intake       enable row level security;

-- each user owns only their own rows
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on public.health_documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own embeddings read" on public.profile_embeddings
  for select using (auth.uid() = user_id);       -- writes only via edge functions (service role)
create policy "own scans" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own intake" on public.daily_intake
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- shared reference data: readable by any signed-in user, written only by service role
create policy "read knowledge" on public.knowledge_chunks
  for select to authenticated using (true);
create policy "read aliases" on public.ingredient_aliases
  for select to authenticated using (true);

-- ───────────────────── vector search functions ─────────────────────
create or replace function public.match_profile_chunks(
  p_user_id uuid, query_embedding extensions.vector(768), match_count int default 5
) returns table (id bigint, source text, chunk_text text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select id, source, chunk_text, 1 - (embedding <=> query_embedding) as similarity
  from public.profile_embeddings
  where user_id = p_user_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_knowledge(
  query_embedding extensions.vector(768), match_count int default 5
) returns table (id bigint, source text, topic text, chunk_text text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select id, source, topic, chunk_text, 1 - (embedding <=> query_embedding) as similarity
  from public.knowledge_chunks
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ───────────────────── private storage buckets ─────────────────────
insert into storage.buckets (id, name, public)
values ('health-docs', 'health-docs', false), ('scan-images', 'scan-images', false)
on conflict (id) do nothing;

-- files must live under a folder named after the user's id: <uid>/<file>
create policy "own files read" on storage.objects for select to authenticated
  using (bucket_id in ('health-docs','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('health-docs','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('health-docs','scan-images') and (storage.foldername(name))[1] = auth.uid()::text);
