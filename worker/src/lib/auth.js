/* =============================================================================
   ADMIN AUTHENTICATION — real, server-side, session-cookie based.
   -----------------------------------------------------------------------------
   • Passwords are verified with PBKDF2-SHA256 against a per-user salt. The
     owner sets their own password locally (scripts/set-admin-password.mjs);
     no password or hash is ever committed to this repository.
   • Sessions are random 256-bit tokens. The database stores only a SHA-256 of
     the token, so a database leak does not hand over live sessions.
   • The cookie is HttpOnly + Secure + SameSite=Strict, which is only workable
     because the admin app is served by this same Worker — same origin as the
     API it calls. That is why the admin UI does not live on the Netlify site.
   • Comparisons are constant-time, so a timing signal cannot be used to probe
     for valid tokens or hashes.
   ========================================================================== */

import { HttpError, unauthorized } from "./http.js";

const SESSION_COOKIE = "yrc_admin";
const SESSION_HOURS = 12;
// 100,000 is the ceiling the Workers runtime allows; anything higher throws
// NotSupportedError at runtime (local Miniflare accepts more, which hides it).
// Below the current OWASP guidance for PBKDF2-SHA256, so the setup script
// enforces a 12-character minimum password to compensate.
const PBKDF2_ITERATIONS = 100000;

const enc = new TextEncoder();

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/* Constant-time string compare. Length is compared without early exit too. */
function timingSafeEqual(a, b) {
  const A = enc.encode(String(a));
  const B = enc.encode(String(b));
  let diff = A.length ^ B.length;
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) diff |= (A[i] || 0) ^ (B[i] || 0);
  return diff === 0;
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

export async function pbkdf2Hex(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = Uint8Array.from(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return toHex(bits);
}

export const defaultIterations = () => PBKDF2_ITERATIONS;

/* ------------------------------------------------------------------ cookies */
function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  const out = {};
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

export function sessionCookie(token, maxAgeSeconds) {
  const bits = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return bits.join("; ");
}

export const clearedCookie = () => sessionCookie("", 0);

/* ------------------------------------------------------- failed-login lock */
/* Password-only sign-in has no username to guess alongside it, so every
   attempt is a whole guess at the secret. Without this an attacker can grind
   the password as fast as the network allows. */
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;

async function assertNotLocked(env, ipHash) {
  const row = await env.DB.prepare(
    "SELECT fails, locked_until FROM login_attempts WHERE ip_hash = ?"
  ).bind(ipHash).first();

  if (row && row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    const mins = Math.ceil((Date.parse(row.locked_until) - Date.now()) / 60000);
    throw new HttpError(429, `Too many attempts. Try again in ${mins} minute(s).`);
  }
  return row;
}

async function recordFailure(env, ipHash, row) {
  const fails = (row ? row.fails : 0) + 1;
  const now = new Date();
  const lockedUntil = fails >= MAX_FAILS
    ? new Date(now.getTime() + LOCK_MINUTES * 60000).toISOString()
    : null;

  await env.DB.prepare(
    `INSERT INTO login_attempts (ip_hash, fails, last_fail_at, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(ip_hash) DO UPDATE SET
       fails = excluded.fails, last_fail_at = excluded.last_fail_at,
       locked_until = excluded.locked_until`
  ).bind(ipHash, fails, now.toISOString(), lockedUntil).run();
}

/* ------------------------------------------------------------------ signin */
/* Password only — there is one owner account, so an email field would just be
   a second thing to type that guards nothing. */
export async function signIn(env, password, ipHash) {
  const locked = await assertNotLocked(env, ipHash);

  const row = await env.DB.prepare(
    "SELECT id, email, password_hash, password_salt, iterations FROM admin_users ORDER BY created_at LIMIT 1"
  ).first();

  // Derive even when no account exists, so response time says nothing about
  // whether the site has been set up yet.
  const salt = row ? row.password_salt : "00".repeat(16);
  const iterations = row ? row.iterations : PBKDF2_ITERATIONS;
  const attempt = await pbkdf2Hex(String(password || ""), salt, iterations);

  if (!row || !timingSafeEqual(attempt, row.password_hash)) {
    await recordFailure(env, ipHash, locked);
    throw new HttpError(401, "That password is not correct.");
  }

  // Clean slate on success, so an honest typo never counts towards a lock.
  await env.DB.prepare("DELETE FROM login_attempts WHERE ip_hash = ?").bind(ipHash).run();

  const token = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 3600 * 1000);

  await env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, row.id, now.toISOString(), expires.toISOString()).run();

  await env.DB.prepare("UPDATE admin_users SET last_login_at = ? WHERE id = ?")
    .bind(now.toISOString(), row.id).run();

  // Opportunistic cleanup; keeps the table from growing without a cron.
  await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?")
    .bind(now.toISOString()).run();

  return { token, maxAge: SESSION_HOURS * 3600, user: { id: row.id, email: row.email } };
}

/* Resolve the caller's session, or throw 401. Every admin route calls this. */
export async function requireAdmin(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) throw unauthorized();

  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.expires_at, u.id AS user_id, u.email
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ?`
  ).bind(await sha256Hex(token)).first();

  if (!row) throw unauthorized();
  if (Date.parse(row.expires_at) < Date.now()) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(row.token_hash).run();
    throw unauthorized("Your session has expired. Please sign in again.");
  }
  return { id: row.user_id, email: row.email };
}

export async function signOut(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
      .bind(await sha256Hex(token)).run();
  }
}
