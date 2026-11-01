-- =====================================================================
-- Magia Reborn: tabelas, permissões e pasta de fotos
-- COMO USAR: no Supabase, abra "SQL Editor", cole este arquivo inteiro e clique em Run.
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- 1) Tabelas (itens, categorias, configurações e lista de administradoras)
create table if not exists public.categories (id text primary key, data jsonb not null default '{}'::jsonb);
create table if not exists public.items      (id text primary key, data jsonb not null default '{}'::jsonb);
create table if not exists public.config     (id text primary key, data jsonb not null default '{}'::jsonb);
create table if not exists public.admins     (user_id uuid primary key references auth.users(id) on delete cascade);

-- 2) Função que diz se quem está logado é administradora
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3) Regras de acesso: qualquer visitante LÊ; só a administradora ALTERA
alter table public.categories enable row level security;
alter table public.items      enable row level security;
alter table public.config     enable row level security;
alter table public.admins     enable row level security;   -- sem regras: ninguém lê pela internet

grant select on public.categories, public.items, public.config to anon, authenticated;
grant insert, update, delete on public.categories, public.items, public.config to authenticated;

do $$
declare t text;
begin
  foreach t in array array['categories','items','config'] loop
    execute format('drop policy if exists "todos podem ver" on public.%I', t);
    execute format('create policy "todos podem ver" on public.%I for select using (true)', t);
    execute format('drop policy if exists "administradora altera" on public.%I', t);
    execute format('create policy "administradora altera" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 4) Atualização em tempo real (a vitrine se atualiza sozinha quando você muda algo)
do $$
declare t text;
begin
  foreach t in array array['categories','items','config'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 5) Pasta de fotos (pública para ver; só a administradora envia e apaga)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: todos veem" on storage.objects;
create policy "fotos: todos veem" on storage.objects for select using (bucket_id = 'fotos');
drop policy if exists "fotos: administradora envia" on storage.objects;
create policy "fotos: administradora envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: administradora altera" on storage.objects;
create policy "fotos: administradora altera" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_admin()) with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "fotos: administradora apaga" on storage.objects;
create policy "fotos: administradora apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_admin());
