/* =============================================================================
   HTTP helpers — CORS, JSON responses, and error shaping.
   -----------------------------------------------------------------------------
   Public endpoints (reviews, quote submission) are called cross-origin from the
   Netlify site, so they carry CORS headers. Admin endpoints are same-origin
   with the admin app served by this Worker, so they deliberately do NOT get
   CORS headers — no other site can call them from a browser at all.
   ========================================================================== */

export function corsHeaders(request, env) {
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

const BASE = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  // Defence in depth for the JSON API surface.
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/* Public JSON response: carries CORS. */
export function json(body, status, request, env, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE, ...corsHeaders(request, env), ...extra },
  });
}

/* Same-origin JSON response for the admin API: no CORS headers on purpose. */
export function adminJson(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE, ...extra },
  });
}

/* Thrown by route code; the router turns it into a clean response and never
   leaks a stack trace to the caller. */
export class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export const badRequest = (msg, field) => new HttpError(400, msg, field);
export const unauthorized = (msg = "Please sign in.") => new HttpError(401, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const tooMany = (msg) => new HttpError(429, msg);

/* Read a JSON body with a hard size ceiling, so a huge payload cannot be used
   to burn Worker CPU before validation runs. */
export async function readJson(request, maxBytes = 256 * 1024) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > maxBytes) throw badRequest("That request is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw badRequest("That request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Expected a JSON body.");
  }
}

/* Salted digest of the caller's IP, used only for flood control. The raw
   address is never stored or logged. */
export async function submitterHash(request, salt) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const data = new TextEncoder().encode(String(salt || "") + "|" + ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const nowIso = () => new Date().toISOString();
