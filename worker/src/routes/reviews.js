/* =============================================================================
   PUBLIC REVIEWS — unchanged behaviour, lifted out of index.js when the Worker
   grew a second feature. Read approved reviews; post one. No update, no delete.
   ========================================================================== */

import { json, readJson, submitterHash, badRequest, tooMany, nowIso } from "../lib/http.js";

const MAX_LIST = 100;
const MIN_SECONDS_BETWEEN_POSTS = 60;
const MAX_POSTS_PER_DAY = 3;

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

export async function listReviews(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT name, role, rating, quote, created_at
       FROM catering_reviews
      WHERE approved = 1
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(MAX_LIST).all();
  return json(results || [], 200, request, env);
}

export async function createReview(request, env) {
  const body = await readJson(request);
  const { error, row } = validate(body || {});
  if (error) throw badRequest(error);

  const ipHash = await submitterHash(request, env.IP_SALT);
  const now = Date.now();

  const recent = await env.DB.prepare(
    `SELECT created_at FROM catering_reviews
      WHERE ip_hash = ? AND created_at > ?
      ORDER BY created_at DESC`
  ).bind(ipHash, new Date(now - 86400000).toISOString()).all();

  const posts = recent.results || [];
  if (posts.length >= MAX_POSTS_PER_DAY) throw tooMany("You have already left a review recently. Thank you!");
  if (posts.length && now - Date.parse(posts[0].created_at) < MIN_SECONDS_BETWEEN_POSTS * 1000) {
    throw tooMany("Please wait a moment before posting again.");
  }

  const created_at = nowIso();
  await env.DB.prepare(
    `INSERT INTO catering_reviews (id, created_at, name, role, rating, quote, approved, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(crypto.randomUUID(), created_at, row.name, row.role, row.rating, row.quote, ipHash).run();

  return json({ ...row, created_at }, 201, request, env);
}
