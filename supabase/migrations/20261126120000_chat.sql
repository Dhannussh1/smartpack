-- Chat assistant history (per user, private)
create table if not exists public.chat_messages (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 6000),
  meta        jsonb,            -- assistant: {reply_ta, used_documents, sources, suggestions}
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at);
alter table public.chat_messages enable row level security;
create policy "own chat" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
