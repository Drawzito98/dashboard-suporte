-- Tolerâncias da auditoria por líder; preserva snapshots e análises anteriores.
begin;
create table if not exists public.ponto_configuracoes (
  user_id uuid primary key references auth.users(id),
  tolerancia_batida integer not null default 5 check (tolerancia_batida between 0 and 120),
  tolerancia_diaria integer not null default 10 check (tolerancia_diaria between 0 and 240),
  updated_at timestamptz not null default now()
);
alter table public.ponto_configuracoes enable row level security;
create policy ponto_config_select on public.ponto_configuracoes for select to authenticated using (user_id = auth.uid() and public.ponto_admin());
create policy ponto_config_insert on public.ponto_configuracoes for insert to authenticated with check (user_id = auth.uid() and public.ponto_admin());
create policy ponto_config_update on public.ponto_configuracoes for update to authenticated using (user_id = auth.uid() and public.ponto_admin()) with check (user_id = auth.uid() and public.ponto_admin());
revoke all on public.ponto_configuracoes from anon;
grant select, insert, update on public.ponto_configuracoes to authenticated;
notify pgrst, 'reload schema';
commit;
