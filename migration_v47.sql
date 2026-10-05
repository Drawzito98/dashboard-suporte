-- Importação estruturada sem retenção de PDF + justificativas relacionadas.
-- Executar depois de v46. Preserva registros e snapshots anteriores.
begin;
alter table public.ponto_importacoes alter column storage_path drop not null;
drop policy ponto_import_insert on public.ponto_importacoes;
create policy ponto_import_insert on public.ponto_importacoes for insert to authenticated
with check (user_id=auth.uid() and public.ponto_admin() and storage_path is null and exists(select 1 from public.ponto_colaboradores c where c.id=colaborador_id and c.user_id=auth.uid()));

-- Impede novas retenções e acesso a PDFs pela versão antiga do app.
drop policy if exists ponto_pdf_insert on storage.objects;
drop policy if exists ponto_pdf_read on storage.objects;
drop policy if exists ponto_pdf_cleanup on storage.objects;
create policy ponto_pdf_deny_insert on storage.objects as restrictive for insert to authenticated,anon with check(bucket_id <> 'ponto-privado');
create policy ponto_pdf_deny_update on storage.objects as restrictive for update to authenticated,anon using(bucket_id <> 'ponto-privado') with check(bucket_id <> 'ponto-privado');
create policy ponto_pdf_deny_read on storage.objects as restrictive for select to authenticated,anon using(bucket_id <> 'ponto-privado');
-- Permite somente a remoção de arquivos legados pelo proprietário administrador.
create policy ponto_pdf_legacy_delete on storage.objects for delete to authenticated
using (bucket_id='ponto-privado' and (storage.foldername(name))[1]=auth.uid()::text and public.ponto_admin());

create table public.ponto_justificativas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.ponto_importacoes(id),
  registro_ponto_id uuid not null references public.ponto_registros(id),
  colaborador_id uuid not null references public.ponto_colaboradores(id),
  data date not null, hora text not null check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  codigo_ocorrencia text not null, descricao text not null,
  pagina integer not null check (pagina > 0),
  batidas_relacionadas jsonb not null default '[]'::jsonb,
  chave_sha256 text not null,
  created_at timestamptz not null default now(),
  unique(importacao_id,chave_sha256)
);
create index ponto_justificativas_registro on public.ponto_justificativas(registro_ponto_id);
alter table public.ponto_justificativas enable row level security;
create policy ponto_just_select on public.ponto_justificativas for select to authenticated
using(public.ponto_admin() and exists(select 1 from public.ponto_importacoes i where i.id=importacao_id and i.user_id=auth.uid()));
create policy ponto_just_insert on public.ponto_justificativas for insert to authenticated
with check(public.ponto_admin() and exists(select 1 from public.ponto_importacoes i join public.ponto_registros r on r.importacao_id=i.id
where i.id=ponto_justificativas.importacao_id and i.user_id=auth.uid() and i.colaborador_id=ponto_justificativas.colaborador_id and r.id=ponto_justificativas.registro_ponto_id and r.data=ponto_justificativas.data));
grant select,insert on public.ponto_justificativas to authenticated;

create function public.ponto_salvar_importacao(p_importacao jsonb,p_registros jsonb,p_justificativas jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid := (p_importacao->>'id')::uuid; v_colaborador uuid := (p_importacao->>'colaborador_id')::uuid; v_count integer;
begin
  if not public.ponto_admin() or auth.uid() is null then raise exception 'Acesso negado'; end if;
  if p_importacao ? 'storage_path' or p_importacao ? 'pdf' or p_importacao ? 'conteudo_binario' then raise exception 'PDFs não devem ser armazenados'; end if;
  if p_registros is null or jsonb_typeof(p_registros)<>'array' then raise exception 'Informe os registros'; end if;
  if jsonb_array_length(p_registros)=0 or jsonb_array_length(p_registros)>400 then raise exception 'Quantidade de registros inválida'; end if;
  if p_justificativas is null or jsonb_typeof(p_justificativas)<>'array' then raise exception 'Informe a lista de justificativas'; end if;
  if jsonb_array_length(p_justificativas)>10000 then raise exception 'Quantidade de justificativas inválida'; end if;
  insert into public.ponto_importacoes(id,user_id,colaborador_id,arquivo,arquivo_sha256,registros_sha256,periodo_inicio,periodo_fim,snapshot)
  values(v_id,auth.uid(),v_colaborador,p_importacao->>'arquivo',p_importacao->>'arquivo_sha256',p_importacao->>'registros_sha256',(p_importacao->>'periodo_inicio')::date,(p_importacao->>'periodo_fim')::date,p_importacao->'snapshot');
  insert into public.ponto_registros(importacao_id,data,extraido,interpretado,calculado)
  select v_id,(r->>'data')::date,r->'extraido',r->'interpretado',r->'calculado' from jsonb_array_elements(p_registros) r;
  insert into public.ponto_justificativas(importacao_id,registro_ponto_id,colaborador_id,data,hora,codigo_ocorrencia,descricao,pagina,batidas_relacionadas,chave_sha256)
  select v_id,r.id,v_colaborador,r.data,j->>'hora',j->>'codigo_ocorrencia',j->>'descricao',(j->>'pagina')::integer,
    coalesce(j->'batidas_relacionadas','[]'::jsonb), encode(sha256(convert_to(jsonb_build_array(r.data,j->>'hora',j->>'codigo_ocorrencia',j->>'descricao')::text,'UTF8')),'hex')
  from jsonb_array_elements(p_justificativas) j join public.ponto_registros r on r.importacao_id=v_id and r.data=(j->>'data')::date
  on conflict(importacao_id,chave_sha256) do nothing;
  select count(*) into v_count from jsonb_array_elements(p_justificativas) j where not exists(select 1 from public.ponto_registros r where r.importacao_id=v_id and r.data=(j->>'data')::date);
  if v_count>0 then raise exception 'Justificativa sem registro diário correspondente'; end if;
  return v_id;
end $$;
-- Compatibilidade para chamadas estruturadas antigas sem justificativas.
create or replace function public.ponto_salvar_importacao(p_importacao jsonb,p_registros jsonb)
returns uuid language sql security invoker set search_path='' as $$
select public.ponto_salvar_importacao(p_importacao,p_registros,'[]'::jsonb)
$$;
revoke all on function public.ponto_salvar_importacao(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.ponto_salvar_importacao(jsonb,jsonb,jsonb) to authenticated;
commit;

-- Arquivos legados, caso existam, precisam de exclusão pela API Storage antes da
-- publicação. Não apagar diretamente storage.objects via SQL. Não excluir análises.
