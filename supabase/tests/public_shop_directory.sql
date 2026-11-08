-- Verify the public shop directory is a read-only, RLS-protected
-- projection that stays synchronized with active shop records.
\set ON_ERROR_STOP on

DO $test$
DECLARE
  v_rls_enabled boolean;
  v_is_table boolean;
  v_function_private boolean;
  v_function_security_definer boolean;
BEGIN
  SELECT c.relkind = 'r', c.relrowsecurity
    INTO v_is_table, v_rls_enabled
  FROM pg_class c
  WHERE c.oid = 'public.public_shops'::regclass;

  IF NOT coalesce(v_is_table, false) THEN
    RAISE EXCEPTION 'public.public_shops must be a table, not a view';
  END IF;
  IF NOT coalesce(v_rls_enabled, false) THEN
    RAISE EXCEPTION 'RLS is not enabled on public.public_shops';
  END IF;

  SELECT n.nspname = 'private', p.prosecdef
    INTO v_function_private, v_function_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.oid = 'private.sync_public_shop_directory()'::regprocedure;

  IF NOT coalesce(v_function_private, false) OR NOT coalesce(v_function_security_definer, false) THEN
    RAISE EXCEPTION 'Directory sync trigger must be a private SECURITY DEFINER function';
  END IF;

  IF has_function_privilege('anon', 'private.sync_public_shop_directory()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.sync_public_shop_directory()', 'EXECUTE')
     OR has_function_privilege('service_role', 'private.sync_public_shop_directory()', 'EXECUTE') THEN
    RAISE EXCEPTION 'API roles must not be able to execute the directory sync function';
  END IF;

  IF has_table_privilege('anon', 'public.public_shops', 'SELECT') IS NOT TRUE
     OR has_table_privilege('authenticated', 'public.public_shops', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'Anonymous and authenticated roles must be able to read the directory';
  END IF;

  IF has_table_privilege('anon', 'public.public_shops', 'INSERT')
     OR has_table_privilege('anon', 'public.public_shops', 'UPDATE')
     OR has_table_privilege('anon', 'public.public_shops', 'DELETE')
     OR has_table_privilege('authenticated', 'public.public_shops', 'INSERT')
     OR has_table_privilege('authenticated', 'public.public_shops', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.public_shops', 'DELETE') THEN
    RAISE EXCEPTION 'Public API roles must not write to the directory';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_shops'
      AND column_name IN ('owner_id', 'is_active', 'created_at', 'updated_at')
  ) THEN
    RAISE EXCEPTION 'Directory exposes internal shop metadata';
  END IF;
END;
$test$;

-- The financial smoke test creates two active shops. Their approved public
-- fields must be present, without granting access to the underlying shops.
SET ROLE anon;
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.public_shops) <> 2 THEN
    RAISE EXCEPTION 'Anonymous directory read did not return the two active shops';
  END IF;
  IF has_table_privilege(current_user, 'public.shops', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not read the internal shops table';
  END IF;
  IF (SELECT upi_id FROM public.public_shops
      WHERE id = '30000000-0000-4000-8000-000000000001') <> 'merchant1@upi' THEN
    RAISE EXCEPTION 'Approved UPI field was not copied to the public directory';
  END IF;
END;
$test$;
RESET ROLE;

-- Exercise the trigger using a disposable shop that has no financial history.
INSERT INTO public.shops (id, owner_id, name, category, is_active)
VALUES (
  '30000000-0000-4000-8000-000000000099',
  '10000000-0000-4000-8000-000000000002',
  'Directory Trigger Test',
  'General',
  true
);

DO $test$
BEGIN
  IF (SELECT name FROM public.public_shops
      WHERE id = '30000000-0000-4000-8000-000000000099') <> 'Directory Trigger Test' THEN
    RAISE EXCEPTION 'New active shop was not published to directory';
  END IF;
END;
$test$;

UPDATE public.shops
SET name = 'Directory Trigger Updated'
WHERE id = '30000000-0000-4000-8000-000000000099';

DO $test$
BEGIN
  IF (SELECT name FROM public.public_shops
      WHERE id = '30000000-0000-4000-8000-000000000099') <> 'Directory Trigger Updated' THEN
    RAISE EXCEPTION 'Shop edits were not synchronized to directory';
  END IF;
END;
$test$;

UPDATE public.shops
SET is_active = false
WHERE id = '30000000-0000-4000-8000-000000000099';

DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM public.public_shops
             WHERE id = '30000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'Deactivated shop remains visible in directory';
  END IF;
END;
$test$;

UPDATE public.shops
SET is_active = true
WHERE id = '30000000-0000-4000-8000-000000000099';

DELETE FROM public.shops
WHERE id = '30000000-0000-4000-8000-000000000099';

DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM public.public_shops
             WHERE id = '30000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'Deleted shop remains visible in directory';
  END IF;
END;
$test$;
