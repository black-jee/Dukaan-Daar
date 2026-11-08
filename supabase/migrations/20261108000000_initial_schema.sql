-- Initial KhataLink schema migration.
-- Canonical baseline migration for Supabase CLI deployments.
-- Apply to an empty project before 20261108000100_harden_financial_ledger.sql.
-- Do not execute the deprecated supabase/schema.sql reference path.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('merchant', 'customer')) DEFAULT 'customer',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shops table
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General', -- Tea, Paan, Grocery, Kirana, etc.
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  upi_id TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shop-Customer linking + credit management
CREATE TABLE public.shop_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_limit DECIMAL(12, 2) DEFAULT 500.00,
  current_balance DECIMAL(12, 2) DEFAULT 0.00, -- positive = customer owes merchant
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'paused')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, customer_id)
);

-- Transactions (immutable ledger with audit)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('credit', 'payment')), -- credit = gave udhar, payment = received
  note TEXT,
  running_balance DECIMAL(12, 2) NOT NULL, -- balance after this transaction
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- No updates/deletes allowed in application logic; soft audit only
  is_reversed BOOLEAN DEFAULT FALSE,
  reversed_by UUID REFERENCES public.profiles(id),
  reversed_at TIMESTAMPTZ,
  reverse_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_shops_owner ON public.shops(owner_id);
CREATE INDEX idx_shops_location ON public.shops(latitude, longitude);
CREATE INDEX idx_shop_customers_shop ON public.shop_customers(shop_id);
CREATE INDEX idx_shop_customers_customer ON public.shop_customers(customer_id);
CREATE INDEX idx_transactions_shop_customer ON public.transactions(shop_id, customer_id);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Merchants can view profiles of their customers (limited)
CREATE POLICY "Merchants can view their customers profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shop_customers sc
      JOIN public.shops s ON s.id = sc.shop_id
      WHERE sc.customer_id = profiles.id AND s.owner_id = auth.uid()
    )
  );

-- Shops policies
CREATE POLICY "Anyone can view active shops"
  ON public.shops FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Owners can manage their shops"
  ON public.shops FOR ALL
  USING (owner_id = auth.uid());

-- Shop customers policies
CREATE POLICY "Customers can view their own links"
  ON public.shop_customers FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Merchants can manage their shop customers"
  ON public.shop_customers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_customers.shop_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Customers can join shops (insert)"
  ON public.shop_customers FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Transactions policies
CREATE POLICY "Customers can view their own transactions"
  ON public.transactions FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Merchants can view/manage transactions of their shops"
  ON public.transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = transactions.shop_id AND s.owner_id = auth.uid()
    )
  );

-- Function to safely add transaction and update balance (call from app or RPC)
CREATE OR REPLACE FUNCTION public.add_transaction(
  p_shop_id UUID,
  p_customer_id UUID,
  p_amount DECIMAL,
  p_type TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sc public.shop_customers%ROWTYPE;
  v_new_balance DECIMAL(12,2);
  v_tx public.transactions%ROWTYPE;
  v_owner_id UUID;
BEGIN
  -- Verify caller is owner or the customer (for payments)
  SELECT owner_id INTO v_owner_id FROM public.shops WHERE id = p_shop_id;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF auth.uid() != v_owner_id AND auth.uid() != p_customer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get current shop_customer row (lock it)
  SELECT * INTO v_sc
  FROM public.shop_customers
  WHERE shop_id = p_shop_id AND customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not linked to this shop';
  END IF;

  IF v_sc.status = 'blocked' AND p_type = 'credit' THEN
    RAISE EXCEPTION 'Customer is blocked from new credit';
  END IF;

  -- Calculate new balance
  IF p_type = 'credit' THEN
    v_new_balance := v_sc.current_balance + p_amount;
    IF v_new_balance > v_sc.credit_limit THEN
      RAISE EXCEPTION 'Credit limit exceeded. Limit: %, would be: %', v_sc.credit_limit, v_new_balance;
    END IF;
  ELSIF p_type = 'payment' THEN
    v_new_balance := GREATEST(0, v_sc.current_balance - p_amount);
  ELSE
    RAISE EXCEPTION 'Invalid type';
  END IF;

  -- Insert transaction
  INSERT INTO public.transactions (
    shop_id, customer_id, amount, type, note, running_balance, created_by
  ) VALUES (
    p_shop_id, p_customer_id, p_amount, p_type, p_note, v_new_balance, auth.uid()
  )
  RETURNING * INTO v_tx;

  -- Update balance
  UPDATE public.shop_customers
  SET current_balance = v_new_balance
  WHERE id = v_sc.id;

  RETURN v_tx;
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.add_transaction TO authenticated;

-- Enable Realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_customers;
