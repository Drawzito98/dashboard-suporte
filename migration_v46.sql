-- Auditoria de Ponto — MVP. Aditiva: não altera tabelas existentes.
begin;

create table public.ponto_colaboradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nome text not null check (length(trim(nome)) between 3 and 200),
  setor text not null default '', ativo boolean not null default true,
  observacoes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index ponto_nome_owner on public.ponto_colaboradores(user_id, lower(trim(nome)));
create table public.ponto_jornadas (
  colaborador_id uuid not null references public.ponto_colaboradores(id),
  dia_semana smallint not null check (dia_semana between 0 and 6),
  trabalha boolean not null, entrada_1 time, saida_1 time, entrada_2 time, saida_2 time,
  minutos_esperados integer not null check (minutos_esperados between 0 and 1440),
  primary key (colaborador_id, dia_semana),
  check (not trabalha or (entrada_1 is not null and saida_1 is not null and entrada_2 is not null and saida_2 is not null and minutos_esperados > 0))
);
create table public.ponto_importacoes (
  id uuid primary key, user_id uuid not null references auth.users(id),
  colaborador_id uuid not null references public.ponto_colaboradores(id),
  arquivo text not null, storage_path text not null unique,
  arquivo_sha256 text not null check (arquivo_sha256 ~ '^[a-f0-9]{64}$'),
  registros_sha256 text not null check (registros_sha256 ~ '^[a-f0-9]{64}$'),
  periodo_inicio date not null, periodo_fim date not null,
  status text not null default 'analisado' check (status = 'analisado'),
  snapshot jsonb not null, data_importacao timestamptz not null default now(),
  check (periodo_fim >= periodo_inicio),
  unique(user_id, arquivo_sha256),
  unique(user_id, colaborador_id, periodo_inicio, periodo_fim, registros_sha256)
);
create table public.ponto_registros (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.ponto_importacoes(id),
  data date not null, extraido jsonb not null, interpretado jsonb not null, calculado jsonb not null,
  unique(importacao_id, data)
);
create index ponto_importacoes_owner_periodo on public.ponto_importacoes(user_id, periodo_inicio);

-- Privado por líder, com papel confiável em app_metadata (nunca user_metadata).
create function public.ponto_admin() returns boolean language sql stable security invoker
set search_path = '' as $$ select coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin' $$;
alter table public.ponto_colaboradores enable row level security;
alter table public.ponto_jornadas enable row level security;
alter table public.ponto_importacoes enable row level security;
alter table public.ponto_registros enable row level security;
create policy ponto_colab_select on public.ponto_colaboradores for select to authenticated using (user_id = auth.uid() and public.ponto_admin());
create policy ponto_colab_insert on public.ponto_colaboradores for insert to authenticated with check (user_id = auth.uid() and public.ponto_admin());
create policy ponto_colab_update on public.ponto_colaboradores for update to authenticated using (user_id = auth.uid() and public.ponto_admin()) with check (user_id = auth.uid() and public.ponto_admin());
create policy ponto_jornada_select on public.ponto_jornadas for select to authenticated using (exists(select 1 from public.ponto_colaboradores c where c.id = colaborador_id and c.user_id = auth.uid()) and public.ponto_admin());
create policy ponto_jornada_insert on public.ponto_jornadas for insert to authenticated with check (exists(select 1 from public.ponto_colaboradores c where c.id = colaborador_id and c.user_id = auth.uid()) and public.ponto_admin());
create policy ponto_jornada_update on public.ponto_jornadas for update to authenticated using (exists(select 1 from public.ponto_colaboradores c where c.id = colaborador_id and c.user_id = auth.uid()) and public.ponto_admin()) with check (exists(select 1 from public.ponto_colaboradores c where c.id = colaborador_id and c.user_id = auth.uid()) and public.ponto_admin());
create policy ponto_import_select on public.ponto_importacoes for select to authenticated using (user_id = auth.uid() and public.ponto_admin());
create policy ponto_import_insert on public.ponto_importacoes for insert to authenticated with check (user_id = auth.uid() and public.ponto_admin() and exists(select 1 from public.ponto_colaboradores c where c.id = colaborador_id and c.user_id = auth.uid()) and storage_path = auth.uid()::text || '/' || id::text || '.pdf');
create policy ponto_reg_select on public.ponto_registros for select to authenticated using (public.ponto_admin() and exists(select 1 from public.ponto_importacoes i where i.id = importacao_id and i.user_id = auth.uid()));
create policy ponto_reg_insert on public.ponto_registros for insert to authenticated with check (public.ponto_admin() and exists(select 1 from public.ponto_importacoes i where i.id = importacao_id and i.user_id = auth.uid() and data between i.periodo_inicio and i.periodo_fim));
-- Nenhuma política de UPDATE/DELETE em importações/registros: snapshots imutáveis.
grant select, insert, update on public.ponto_colaboradores, public.ponto_jornadas to authenticated;
grant select, insert on public.ponto_importacoes, public.ponto_registros to authenticated;

create function public.ponto_salvar_colaborador(p_id uuid, p_nome text, p_setor text, p_ativo boolean, p_observacoes text, p_jornadas jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not public.ponto_admin() or auth.uid() is null then raise exception 'Acesso negado'; end if;
  if p_jornadas is null or jsonb_typeof(p_jornadas) <> 'array' then raise exception 'Informe as jornadas'; end if;
  if jsonb_array_length(p_jornadas) <> 7 then raise exception 'Informe os sete dias da semana'; end if;
  if p_id is null then
    insert into public.ponto_colaboradores(user_id,nome,setor,ativo,observacoes) values(auth.uid(),trim(p_nome),p_setor,p_ativo,p_observacoes) returning id into v_id;
  else
    update public.ponto_colaboradores set nome=trim(p_nome),setor=p_setor,ativo=p_ativo,observacoes=p_observacoes,updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Colaborador não encontrado'; end if;
  end if;
  insert into public.ponto_jornadas(colaborador_id,dia_semana,trabalha,entrada_1,saida_1,entrada_2,saida_2,minutos_esperados)
  select v_id,(j->>'dia_semana')::smallint,(j->>'trabalha')::boolean,nullif(j->>'entrada_1','')::time,nullif(j->>'saida_1','')::time,nullif(j->>'entrada_2','')::time,nullif(j->>'saida_2','')::time,(j->>'minutos_esperados')::integer
  from jsonb_array_elements(p_jornadas) j
  on conflict(colaborador_id,dia_semana) do update set trabalha=excluded.trabalha,entrada_1=excluded.entrada_1,saida_1=excluded.saida_1,entrada_2=excluded.entrada_2,saida_2=excluded.saida_2,minutos_esperados=excluded.minutos_esperados;
  return v_id;
end $$;

create function public.ponto_salvar_importacao(p_importacao jsonb, p_registros jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := (p_importacao->>'id')::uuid;
begin
  if not public.ponto_admin() or auth.uid() is null then raise exception 'Acesso negado'; end if;
  if p_registros is null or jsonb_typeof(p_registros) <> 'array' then raise exception 'Informe os registros'; end if;
  if jsonb_array_length(p_registros) = 0 or jsonb_array_length(p_registros) > 400 then raise exception 'Quantidade de registros inválida'; end if;
  insert into public.ponto_importacoes(id,user_id,colaborador_id,arquivo,storage_path,arquivo_sha256,registros_sha256,periodo_inicio,periodo_fim,snapshot)
  values(v_id,auth.uid(),(p_importacao->>'colaborador_id')::uuid,p_importacao->>'arquivo',p_importacao->>'storage_path',p_importacao->>'arquivo_sha256',p_importacao->>'registros_sha256',(p_importacao->>'periodo_inicio')::date,(p_importacao->>'periodo_fim')::date,p_importacao->'snapshot');
  insert into public.ponto_registros(importacao_id,data,extraido,interpretado,calculado)
  select v_id,(r->>'data')::date,r->'extraido',r->'interpretado',r->'calculado' from jsonb_array_elements(p_registros) r;
  return v_id;
end $$;
revoke all on function public.ponto_salvar_colaborador(uuid,text,text,boolean,text,jsonb), public.ponto_salvar_importacao(jsonb,jsonb) from public, anon;
grant execute on function public.ponto_salvar_colaborador(uuid,text,text,boolean,text,jsonb), public.ponto_salvar_importacao(jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ponto-privado','ponto-privado',false,20971520,array['application/pdf']) on conflict(id) do nothing;
create policy ponto_pdf_read on storage.objects for select to authenticated using (bucket_id='ponto-privado' and (storage.foldername(name))[1]=auth.uid()::text and public.ponto_admin());
create policy ponto_pdf_insert on storage.objects for insert to authenticated with check (bucket_id='ponto-privado' and (storage.foldername(name))[1]=auth.uid()::text and public.ponto_admin());
create policy ponto_pdf_cleanup on storage.objects for delete to authenticated using (bucket_id='ponto-privado' and (storage.foldername(name))[1]=auth.uid()::text and public.ponto_admin() and not exists(select 1 from public.ponto_importacoes i where i.storage_path=name));
commit;
