-- Link each vector chunk to the health document it came from, so deleting/replacing
-- a document removes its vectors too (no stale embeddings in the user's context).
alter table public.profile_embeddings
  add column if not exists document_id uuid references public.health_documents(id) on delete cascade;
create index if not exists profile_embeddings_document_idx on public.profile_embeddings (document_id);

alter table public.health_documents
  add column if not exists summary text,
  add column if not exists processed_at timestamptz,
  add column if not exists error text;

-- Search can be limited to the user's own chunks (RLS also enforces this).
drop function if exists public.match_profile_chunks(uuid, extensions.vector, int);
create function public.match_profile_chunks(
  p_user_id uuid, query_embedding extensions.vector(768), match_count int default 5
) returns table (id bigint, source text, chunk_text text, similarity float, document_id uuid)
language sql stable
set search_path = public, extensions
as $$
  select id, source, chunk_text, 1 - (embedding <=> query_embedding) as similarity, document_id
  from public.profile_embeddings
  where user_id = p_user_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Contact page feedback
create table if not exists public.feedback (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  message     text not null check (char_length(message) between 3 and 4000),
  created_at  timestamptz not null default now()
);
alter table public.feedback enable row level security;
create policy "insert own feedback" on public.feedback
  for insert to authenticated with check (auth.uid() = user_id);
create policy "read own feedback" on public.feedback
  for select to authenticated using (auth.uid() = user_id);
