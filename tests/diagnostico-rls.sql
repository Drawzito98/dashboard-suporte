BEGIN;
DO $$ BEGIN PERFORM set_config('diagnostico.test_owner', (SELECT id::text FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin' LIMIT 1), true); END $$;
DO $$ BEGIN PERFORM set_config('diagnostico.test_row', gen_random_uuid()::text, true); END $$;
DO $$ BEGIN
  IF nullif(current_setting('diagnostico.test_owner', true), '') IS NULL THEN RAISE EXCEPTION 'Nenhum administrador disponível para validar'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('diagnostico.test_owner'),'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true); END $$;
INSERT INTO public.diagnostico_revisoes(id,user_id,fingerprint,status,note,snapshot)
VALUES(current_setting('diagnostico.test_row')::uuid,current_setting('diagnostico.test_owner')::uuid,repeat('a',64),'validado','Teste transacional; será desfeito','{"teste":true}'::jsonb);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.diagnostico_revisoes WHERE id=current_setting('diagnostico.test_row')::uuid) <> 1 THEN RAISE EXCEPTION 'Admin não conseguiu consultar a própria revisão'; END IF;
 BEGIN
  INSERT INTO public.diagnostico_revisoes(user_id,fingerprint,status,note,snapshot) VALUES(auth.uid(),repeat('b',64),'ajustado','','{}');
  RAISE EXCEPTION 'Ajuste vazio foi aceito';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE public.diagnostico_revisoes SET note='Alteração indevida' WHERE id=current_setting('diagnostico.test_row')::uuid;
  RAISE EXCEPTION 'UPDATE foi permitido';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
  DELETE FROM public.diagnostico_revisoes WHERE id=current_setting('diagnostico.test_row')::uuid;
  RAISE EXCEPTION 'DELETE foi permitido';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('diagnostico.test_owner'),'role','authenticated','app_metadata',jsonb_build_object('role','viewer'))::text,true); END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.diagnostico_revisoes WHERE id=current_setting('diagnostico.test_row')::uuid) THEN RAISE EXCEPTION 'Viewer conseguiu consultar revisão'; END IF;
 BEGIN
  INSERT INTO public.diagnostico_revisoes(user_id,fingerprint,status,snapshot) VALUES(auth.uid(),repeat('c',64),'validado','{}');
  RAISE EXCEPTION 'Viewer conseguiu gravar revisão';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
DO $$ BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated','app_metadata',jsonb_build_object('role','admin'))::text,true); END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.diagnostico_revisoes WHERE id=current_setting('diagnostico.test_row')::uuid) THEN RAISE EXCEPTION 'Outro admin leu revisão privada'; END IF;
 BEGIN
  INSERT INTO public.diagnostico_revisoes(user_id,fingerprint,status,snapshot) VALUES(current_setting('diagnostico.test_owner')::uuid,repeat('d',64),'validado','{}');
  RAISE EXCEPTION 'Outro admin gravou em nome do proprietário';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM 1 FROM public.diagnostico_revisoes LIMIT 1;
  RAISE EXCEPTION 'Anônimo consultou a tabela';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: gravação e leitura do admin, bloqueio de viewer e anônimo, isolamento entre admins, ajuste obrigatório e histórico imutável; testes desfeitos' AS resultado;
