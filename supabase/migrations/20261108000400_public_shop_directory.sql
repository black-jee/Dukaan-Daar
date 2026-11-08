-- Replace the SECURITY DEFINER public shop view with a narrowly scoped,
-- read-only directory table. This preserves the public_shops Data API shape
-- while keeping the private shops table behind its owner-only RLS policies.
BEGIN;

DROP POLICY shop_customers_customer_join ON public.shop_customers;

DROP VIEW public.public_shops;

CREATE TABLE public.public_shops (
  id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  upi_id text,
  description text
);

ALTER TABLE public.public_shops ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_shops FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.public_shops TO anon, authenticated, service_role;

CREATE POLICY "Public shop directory is readable"
  ON public.public_shops
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY shop_customers_customer_join
  ON public.shop_customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND private.current_profile_role() = 'customer'
    AND EXISTS (
      SELECT 1
      FROM public.public_shops s
      WHERE s.id = shop_customers.shop_id
    )
  );

-- This function is deliberately private and callable only by its trigger.
-- SECURITY DEFINER is required because shop owners must not receive write
-- privileges on the public directory table itself.
CREATE OR REPLACE FUNCTION private.sync_public_shop_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.is_active IS TRUE THEN
    INSERT INTO public.public_shops (
      id, name, category, address, latitude, longitude, upi_id, description
    )
    VALUES (
      NEW.id, NEW.name, NEW.category, NEW.address, NEW.latitude,
      NEW.longitude, NEW.upi_id, NEW.description
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        category = EXCLUDED.category,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        upi_id = EXCLUDED.upi_id,
        description = EXCLUDED.description;
  ELSE
    DELETE FROM public.public_shops
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.sync_public_shop_directory() FROM PUBLIC, anon, authenticated, service_role;

-- Install the trigger before backfilling. Its table lock prevents concurrent
-- shop writes from slipping between the backfill snapshot and trigger install.
CREATE TRIGGER sync_public_shop_directory
  AFTER INSERT OR UPDATE OF
    name, category, address, latitude, longitude, upi_id, description, is_active
  ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_public_shop_directory();

INSERT INTO public.public_shops (
  id, name, category, address, latitude, longitude, upi_id, description
)
SELECT
  id, name, category, address, latitude, longitude, upi_id, description
FROM public.shops
WHERE is_active IS TRUE
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    upi_id = EXCLUDED.upi_id,
    description = EXCLUDED.description;

COMMIT;
