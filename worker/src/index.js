/* =============================================================================
   REVIEWS API — Cloudflare Worker backed by D1
   -----------------------------------------------------------------------------
   Replaces the old Supabase/PostgREST endpoint. D1 has no row-level security,
   so this Worker *is* the security boundary: it is the only thing that talks to
   the database, and it decides what may be read and written.

     GET  /api/reviews   → approved reviews, newest first
     POST /api/reviews   → { name, role?, rating, quote } → the created review

   Everything else 404s. There is deliberately no update or delete route — a
   review is hidden or removed by the owner from the D1 console, never over HTTP.
   ========================================================================== */

const MAX_LIST = 100;

/* Flood control, per hashed IP. */
const MIN_SECONDS_BETWEEN_POSTS = 60;
const MAX_POSTS_PER_DAY = 3;

/* ------------------------------------------------------------------- CORS */
/* ALLOWED_ORIGINS is a comma-separated list in wrangler.jsonc. "*" lets any
   site post, which is only appropriate before the real domain is known. */
function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "*")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const open = allowed.includes("*");
  const ok = open || allowed.includes(origin);

  return {
    "Access-Control-Allow-Origin": ok ? (open && !origin ? "*" : origin || "*") : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });
}

/* --------------------------------------------------------------- utilities */
/* Salted so the stored digest is useless to anyone who gets the database:
   without IP_SALT you cannot test a guessed address against it. */
async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(String(salt || "") + "|" + String(ip || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Mirrors the CHECK constraints in schema.sql, so the caller gets a useful
   message instead of a raw database error. */
function validate(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";
  const quote = typeof body.quote === "string" ? body.quote.trim() : "";
  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Please choose a star rating." };
  if (name.length < 2 || name.length > 60) return { error: "Please enter your name." };
  if (role.length > 60) return { error: "That occasion is too long." };
  if (quote.length < 10 || quote.length > 600) return { error: "Please tell us a little more (at least 10 characters)." };

  return { row: { name, role: role || null, rating, quote } };
}

/* ------------------------------------------------------------------ routes */
async function listReviews(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT name, role, rating, quote, created_at
       FROM catering_reviews
      WHERE approved = 1
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(MAX_LIST).all();

  return json(results || [], 200, request, env);
}

async function createReview(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400, request, env);
  }

  const { error, row } = validate(body || {});
  if (error) return json({ error }, 400, request, env);

  const ipHash = await hashIp(request.headers.get("CF-Connecting-IP") || "unknown", env.IP_SALT);
  const now = Date.now();

  const recent = await env.DB.prepare(
    `SELECT created_at FROM catering_reviews
      WHERE ip_hash = ? AND created_at > ?
      ORDER BY created_at DESC`
  ).bind(ipHash, new Date(now - 24 * 60 * 60 * 1000).toISOString()).all();

  const posts = recent.results || [];
  if (posts.length >= MAX_POSTS_PER_DAY) {
    return json({ error: "You have already left a review recently. Thank you!" }, 429, request, env);
  }
  if (posts.length && now - Date.parse(posts[0].created_at) < MIN_SECONDS_BETWEEN_POSTS * 1000) {
    return json({ error: "Please wait a moment before posting again." }, 429, request, env);
  }

  const created_at = new Date(now).toISOString();
  await env.DB.prepare(
    `INSERT INTO catering_reviews (id, created_at, name, role, rating, quote, approved, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(crypto.randomUUID(), created_at, row.name, row.role, row.rating, row.quote, ipHash).run();

  // Only the public fields go back — never approved or ip_hash.
  return json({ ...row, created_at }, 201, request, env);
}

/* -------------------------------------------------------------------- entry */
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (pathname !== "/api/reviews") {
      return json({ error: "Not found" }, 404, request, env);
    }

    try {
      if (request.method === "GET") return await listReviews(request, env);
      if (request.method === "POST") return await createReview(request, env);
    } catch (err) {
      console.error("reviews api failed", err);
      return json({ error: "Something went wrong. Please try again." }, 500, request, env);
    }

    return json({ error: "Method not allowed" }, 405, request, env);
  },
};
