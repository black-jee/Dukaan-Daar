import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const cleanEnv = (value) => value?.trim().replace(/^["\']|["\']$/g, "");
const apiUrl = cleanEnv(process.env.API_URL);
const anonKey = cleanEnv(process.env.ANON_KEY);
if (!apiUrl || !anonKey) {
  throw new Error("API_URL and ANON_KEY must come from `supabase status -o env`");
}

const suffix = randomUUID();
const password = `KhataLink-Test-${randomUUID()}-Aa9!`;
const base = apiUrl.replace(/\/$/, "");

async function request(path, { method = "GET", token, body, prefer } = {}) {
  const headers = {
    apikey: anonKey,
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (prefer) headers.prefer = prefer;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function signup(label, role) {
  const result = await request("/auth/v1/signup", {
    method: "POST",
    body: {
      email: `khatalink-${label}-${suffix}@example.test`,
      password,
      data: { full_name: `CI ${label}`, role },
    },
  });
  assert.equal(result.response.status, 200, `signup ${label}: ${JSON.stringify(result.data)}`);
  assert.ok(result.data?.user?.id, `signup ${label} must return a user id`);
  assert.ok(result.data?.access_token, `signup ${label} must return a session (email confirmation disabled locally)`);
  return { id: result.data.user.id, access: result.data.access_token, refresh: result.data.refresh_token };
}

const merchant = await signup("merchant", "merchant");
const customer = await signup("customer", "customer");
const escalation = await signup("role-escalation", "admin");

async function profile(user, expectedRole) {
  const result = await request(`/rest/v1/profiles?id=eq.${user.id}&select=id,role`, { token: user.access });
  assert.equal(result.response.status, 200, `profile read: ${JSON.stringify(result.data)}`);
  assert.equal(result.data?.length, 1, "signup trigger must create exactly one profile");
  assert.equal(result.data[0].role, expectedRole, "profile role must match secure signup policy");
}
await profile(merchant, "merchant");
await profile(customer, "customer");
await profile(escalation, "customer");

const shopInsert = await request("/rest/v1/shops?select=id,name", {
  method: "POST",
  token: merchant.access,
  prefer: "return=representation",
  body: {
    owner_id: merchant.id,
    name: `CI Shop ${suffix.slice(0, 8)}`,
    category: "Grocery",
    address: "Local integration test",
    upi_id: "ci-test@upi",
    description: "Disposable local Supabase Auth test",
  },
});
assert.equal(shopInsert.response.status, 201, `merchant shop insert: ${JSON.stringify(shopInsert.data)}`);
const shop = shopInsert.data?.[0];
assert.ok(shop?.id, "merchant should create their own shop");

const publicDiscovery = await request("/rest/v1/public_shops?select=id,name,upi_id");
assert.equal(publicDiscovery.response.status, 200, "anonymous public shop discovery must work");
assert.ok(publicDiscovery.data.some((item) => item.id === shop.id), "new shop must appear in public discovery");

const anonymousPrivateRead = await request("/rest/v1/shops?select=id");
assert.ok(anonymousPrivateRead.response.status >= 400, "anonymous direct internal shop read must be denied");

const customerInternalRead = await request("/rest/v1/shops?select=id", { token: customer.access });
assert.equal(customerInternalRead.response.status, 200, "authenticated customer request should be evaluated by RLS");
assert.equal(customerInternalRead.data.length, 0, "customer must not see another owner's internal shop row");

const join = await request("/rest/v1/shop_customers", {
  method: "POST",
  token: customer.access,
  prefer: "return=minimal",
  body: { shop_id: shop.id, customer_id: customer.id },
});
assert.equal(join.response.status, 201, `customer self-join: ${JSON.stringify(join.data)}`);

const merchantLinks = await request(`/rest/v1/shop_customers?shop_id=eq.${shop.id}&select=id,customer_id`, { token: merchant.access });
assert.equal(merchantLinks.response.status, 200);
assert.equal(merchantLinks.data.length, 1, "merchant should see own customer link");

const transaction = await request("/rest/v1/rpc/add_transaction", {
  method: "POST",
  token: merchant.access,
  body: {
    p_shop_id: shop.id,
    p_customer_id: customer.id,
    p_amount: 12.5,
    p_type: "credit",
    p_idempotency_key: randomUUID(),
    p_note: "local auth integration",
  },
});
assert.equal(transaction.response.status, 200, `merchant ledger RPC: ${JSON.stringify(transaction.data)}`);

const unauthorizedTransaction = await request("/rest/v1/rpc/add_transaction", {
  method: "POST",
  token: customer.access,
  body: {
    p_shop_id: shop.id,
    p_customer_id: customer.id,
    p_amount: 1,
    p_type: "credit",
    p_idempotency_key: randomUUID(),
    p_note: "must fail",
  },
});
assert.ok(unauthorizedTransaction.response.status >= 400, "customer must not record merchant ledger transactions");

const refresh = await request("/auth/v1/token?grant_type=refresh_token", {
  method: "POST",
  body: { refresh_token: customer.refresh },
});
assert.equal(refresh.response.status, 200, `refresh token rotation: ${JSON.stringify(refresh.data)}`);
assert.ok(refresh.data?.access_token && refresh.data?.refresh_token, "refresh must issue a new session");
const refreshedUser = await request("/auth/v1/user", { token: refresh.data.access_token });
assert.equal(refreshedUser.response.status, 200, "refreshed access token must authenticate");

const logout = await request("/auth/v1/logout", { method: "POST", token: refresh.data.access_token });
assert.ok(logout.response.status === 204 || logout.response.status === 200, `logout: ${logout.response.status}`);

console.log("Local Supabase Auth/PostgREST integration passed: signup, secure role defaults, profile trigger, JWT-authenticated RLS, public discovery, customer join, merchant-only ledger RPC, refresh and logout.");
