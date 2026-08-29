/* =============================================================================
   ADMIN API — every route below requires a valid session, checked server-side.
   -----------------------------------------------------------------------------
   Same-origin with the admin app this Worker serves, so responses carry no CORS
   headers: another website cannot call these from a browser at all. Hiding
   buttons is not a control; requireAdmin() is.
   ========================================================================== */

import { adminJson, HttpError, badRequest, notFound, readJson, nowIso } from "../lib/http.js";
import { requireAdmin, signIn, signOut, sessionCookie, clearedCookie } from "../lib/auth.js";
import { CONFIG, valuesOf } from "../lib/config.js";

const JSON_COLUMNS = [
  "catering_services", "meal_requirements", "dietary_requirements", "event_style",
];

function hydrate(row) {
  if (!row) return row;
  const out = { ...row };
  for (const c of JSON_COLUMNS) {
    try { out[c] = JSON.parse(out[c] || "[]"); } catch { out[c] = []; }
  }
  delete out.submitter_hash;   // never leaves the database
  return out;
}

async function logActivity(env, enquiryId, kind, detail, actor) {
  await env.DB.prepare(
    `INSERT INTO enquiry_activity (id, enquiry_id, kind, detail, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), enquiryId, kind, detail, actor, nowIso()).run();
}

const touch = (env, id) =>
  env.DB.prepare("UPDATE enquiries SET updated_at = ? WHERE id = ?").bind(nowIso(), id).run();

/* -------------------------------------------------------------- session ---- */
export async function postLogin(request, env) {
  const body = await readJson(request);
  const { token, maxAge, user } = await signIn(env, body.email, body.password);
  return adminJson({ ok: true, user }, 200, { "Set-Cookie": sessionCookie(token, maxAge) });
}

export async function postLogout(request, env) {
  await signOut(request, env);
  return adminJson({ ok: true }, 200, { "Set-Cookie": clearedCookie() });
}

export async function getMe(request, env) {
  const user = await requireAdmin(request, env);
  return adminJson({ user, config: CONFIG });
}

/* ------------------------------------------------------------ dashboard ---- */
export async function getDashboard(request, env) {
  await requireAdmin(request, env);

  const counts = await env.DB.prepare(
    `SELECT status, COUNT(*) AS n FROM enquiries WHERE archived = 0 GROUP BY status`
  ).all();

  const byStatus = {};
  for (const s of CONFIG.statuses) byStatus[s.value] = 0;
  for (const r of counts.results || []) byStatus[r.status] = r.n;

  const totals = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM enquiries WHERE archived = 0) AS active,
       (SELECT COUNT(*) FROM enquiries WHERE archived = 1) AS archived,
       (SELECT COUNT(*) FROM enquiries) AS total,
       (SELECT COUNT(*) FROM enquiries WHERE archived = 0 AND event_date >= date('now')) AS upcoming`
  ).first();

  const recent = await env.DB.prepare(
    `SELECT id, reference, full_name, event_type, event_date, venue_city, city,
            guest_count, approximate_budget, status, priority, created_at
       FROM enquiries WHERE archived = 0
      ORDER BY created_at DESC LIMIT 10`
  ).all();

  return adminJson({ byStatus, totals, recent: recent.results || [] });
}

/* ------------------------------------------------------------- listing ----- */
export async function listEnquiries(request, env) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const q = url.searchParams;

  const where = [];
  const binds = [];

  where.push("archived = ?");
  binds.push(q.get("archived") === "1" ? 1 : 0);

  const status = q.get("status");
  if (status && valuesOf(CONFIG.statuses).has(status)) { where.push("status = ?"); binds.push(status); }

  const eventType = q.get("event_type");
  if (eventType && valuesOf(CONFIG.eventTypes).has(eventType)) { where.push("event_type = ?"); binds.push(eventType); }

  const priority = q.get("priority");
  if (priority && valuesOf(CONFIG.priorities).has(priority)) { where.push("priority = ?"); binds.push(priority); }

  const budget = q.get("budget");
  if (budget && valuesOf(CONFIG.budgets).has(budget)) { where.push("approximate_budget = ?"); binds.push(budget); }

  const from = q.get("event_from"); if (/^\d{4}-\d{2}-\d{2}$/.test(from || "")) { where.push("event_date >= ?"); binds.push(from); }
  const to   = q.get("event_to");   if (/^\d{4}-\d{2}-\d{2}$/.test(to   || "")) { where.push("event_date <= ?"); binds.push(to); }
  const sub  = q.get("since");      if (/^\d{4}-\d{2}-\d{2}$/.test(sub  || "")) { where.push("created_at >= ?"); binds.push(sub); }

  const minGuests = Number(q.get("min_guests"));
  if (Number.isInteger(minGuests) && minGuests > 0) { where.push("guest_count >= ?"); binds.push(minGuests); }

  const city = (q.get("city") || "").trim();
  if (city) { where.push("(LOWER(city) LIKE ? OR LOWER(venue_city) LIKE ?)"); binds.push(`%${city.toLowerCase()}%`, `%${city.toLowerCase()}%`); }

  // Free-text search across the fields an admin actually looks people up by.
  // Bound seven times rather than reusing ?1: SQLite assigns each bare `?` the
  // next index after the highest one already used, so mixing the two styles
  // makes the binding order depend on which filters happened to be active.
  const search = (q.get("q") || "").trim().toLowerCase();
  if (search) {
    where.push(`(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ?
                 OR LOWER(reference) LIKE ? OR LOWER(COALESCE(venue_name,'')) LIKE ?
                 OR LOWER(COALESCE(city,'')) LIKE ? OR LOWER(COALESCE(venue_city,'')) LIKE ?)`);
    for (let i = 0; i < 7; i++) binds.push(`%${search}%`);
  }

  const SORTS = {
    newest: "created_at DESC",
    oldest: "created_at ASC",
    event_soon: "event_date ASC",
    largest: "guest_count DESC",
    smallest: "guest_count ASC",
  };
  const order = SORTS[q.get("sort")] || SORTS.newest;

  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || 50));
  const offset = Math.max(0, Number(q.get("offset")) || 0);

  const sql =
    `SELECT id, reference, full_name, email, phone, event_type, event_date,
            city, venue_city, venue_name, guest_count, approximate_budget,
            status, priority, created_at, quoted_amount, quote_currency
       FROM enquiries
      WHERE ${where.join(" AND ")}
      ORDER BY ${order} LIMIT ? OFFSET ?`;

  const rows = await env.DB.prepare(sql).bind(...binds, limit, offset).all();
  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM enquiries WHERE ${where.join(" AND ")}`
  ).bind(...binds).first();

  return adminJson({ rows: rows.results || [], total: count.n, limit, offset });
}

/* -------------------------------------------------------------- detail ----- */
export async function getEnquiry(request, env, id) {
  const user = await requireAdmin(request, env);

  const row = await env.DB.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
  if (!row) throw notFound("That enquiry no longer exists.");

  const [notes, activity, files] = await Promise.all([
    env.DB.prepare("SELECT id, body, author, created_at FROM enquiry_notes WHERE enquiry_id = ? ORDER BY created_at DESC").bind(id).all(),
    env.DB.prepare("SELECT kind, detail, actor, created_at FROM enquiry_activity WHERE enquiry_id = ? ORDER BY created_at DESC").bind(id).all(),
    env.DB.prepare("SELECT id, filename, content_type, size_bytes, created_at FROM enquiry_files WHERE enquiry_id = ?").bind(id).all(),
  ]);

  // Worth recording that it has been seen, but only the first time. Keying off
  // status alone logged a new entry on every view while it stayed "new".
  const seen = await env.DB.prepare(
    "SELECT 1 FROM enquiry_activity WHERE enquiry_id = ? AND kind = 'opened' LIMIT 1"
  ).bind(id).first();
  if (!seen) {
    await logActivity(env, id, "opened", "Enquiry opened for the first time", user.email);
  }

  return adminJson({
    enquiry: hydrate(row),
    notes: notes.results || [],
    activity: activity.results || [],
    files: files.results || [],
  });
}

/* -------------------------------------------------------------- updates ---- */
const FREE_TEXT_FIELDS = new Set([
  "full_name", "email", "phone", "address_line", "city", "region", "postcode",
  "venue_name", "venue_address", "venue_city", "venue_region", "venue_postcode",
  "theme_colours", "menu_description", "dietary_details", "additional_information",
  "quote_notes", "assigned_to",
]);

export async function patchEnquiry(request, env, id) {
  const user = await requireAdmin(request, env);
  const body = await readJson(request);

  const row = await env.DB.prepare("SELECT * FROM enquiries WHERE id = ?").bind(id).first();
  if (!row) throw notFound("That enquiry no longer exists.");

  const sets = [];
  const binds = [];
  const changes = [];

  const set = (col, value, label) => {
    if (String(row[col] ?? "") === String(value ?? "")) return;   // nothing to do
    sets.push(`${col} = ?`);
    binds.push(value);
    changes.push(`${label}: ${row[col] ?? "—"} → ${value ?? "—"}`);
  };

  if ("status" in body) {
    if (!valuesOf(CONFIG.statuses).has(body.status)) throw badRequest("That is not a valid status.");
    set("status", body.status, "Status");
  }
  if ("priority" in body) {
    if (!valuesOf(CONFIG.priorities).has(body.priority)) throw badRequest("That is not a valid priority.");
    set("priority", body.priority, "Priority");
  }
  if ("archived" in body) set("archived", body.archived ? 1 : 0, "Archived");

  if ("guest_count" in body) {
    const n = Number(body.guest_count);
    if (!Number.isInteger(n) || n < 1 || n > CONFIG.limits.maxGuests) throw badRequest("Guest count must be a whole number of at least 1.");
    set("guest_count", n, "Guest count");
  }
  if ("event_date" in body) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.event_date || "")) throw badRequest("That is not a valid event date.");
    set("event_date", body.event_date, "Event date");
  }

  /* ---- quote fields ---- */
  if ("quoted_amount" in body) {
    const v = body.quoted_amount === null || body.quoted_amount === "" ? null : Number(body.quoted_amount);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 10_000_000)) throw badRequest("That quote amount is not valid.");
    set("quoted_amount", v, "Quote amount");
  }
  if ("quote_currency" in body) {
    if (!CONFIG.currency.options.includes(body.quote_currency)) throw badRequest("That currency is not supported.");
    set("quote_currency", body.quote_currency, "Currency");
  }
  if ("deposit_amount" in body) {
    const v = body.deposit_amount === null || body.deposit_amount === "" ? null : Number(body.deposit_amount);
    if (v !== null && (!Number.isFinite(v) || v < 0)) throw badRequest("That deposit amount is not valid.");
    set("deposit_amount", v, "Deposit amount");
  }
  if ("deposit_percent" in body) {
    const v = body.deposit_percent === null || body.deposit_percent === "" ? null : Number(body.deposit_percent);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) throw badRequest("Deposit percentage must be between 0 and 100.");
    set("deposit_percent", v, "Deposit percentage");
  }
  if ("quote_expiry" in body) {
    const v = body.quote_expiry || null;
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest("That is not a valid expiry date.");
    set("quote_expiry", v, "Quote expiry");
  }

  for (const field of FREE_TEXT_FIELDS) {
    if (!(field in body)) continue;
    const v = body[field] === null ? null : String(body[field]).trim().slice(0, CONFIG.limits.longText);
    set(field, v || null, field.replace(/_/g, " "));
  }

  if (!sets.length) return adminJson({ ok: true, unchanged: true });

  sets.push("updated_at = ?");
  binds.push(nowIso(), id);

  await env.DB.prepare(`UPDATE enquiries SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();

  // One activity entry per field changed, so the timeline reads as a history
  // rather than "something was edited".
  for (const change of changes) {
    const kind = change.startsWith("Status") ? "status_changed"
      : change.startsWith("Quote") || change.startsWith("Deposit") || change.startsWith("Currency") ? "quote_changed"
      : "edited";
    await logActivity(env, id, kind, change, user.email);
  }

  return adminJson({ ok: true, changed: changes.length });
}

/* ---------------------------------------------------------------- notes ---- */
export async function addNote(request, env, id) {
  const user = await requireAdmin(request, env);
  const body = await readJson(request);
  const note = String(body.body || "").trim();
  if (note.length < 1 || note.length > 4000) throw badRequest("Please write a note first.");

  const exists = await env.DB.prepare("SELECT id FROM enquiries WHERE id = ?").bind(id).first();
  if (!exists) throw notFound("That enquiry no longer exists.");

  const noteId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO enquiry_notes (id, enquiry_id, body, author, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(noteId, id, note, user.email, nowIso()).run();

  await logActivity(env, id, "note_added", "Internal note added", user.email);
  await touch(env, id);
  return adminJson({ ok: true, id: noteId }, 201);
}

/* ---------------------------------------------------------------- files ---- */
export async function downloadFile(request, env, fileId) {
  await requireAdmin(request, env);

  const row = await env.DB.prepare(
    "SELECT r2_key, filename, content_type FROM enquiry_files WHERE id = ?"
  ).bind(fileId).first();
  if (!row) throw notFound("That file no longer exists.");

  const object = await env.UPLOADS.get(row.r2_key);
  if (!object) throw notFound("That file is no longer stored.");

  // Attachments are streamed through this authenticated route; the R2 bucket
  // itself is private and has no public URL.
  return new Response(object.body, {
    headers: {
      "Content-Type": row.content_type,
      "Content-Disposition": `inline; filename="${row.filename.replace(/[^\w. -]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // A customer-supplied file must never run script in the admin's session.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
    },
  });
}

/* --------------------------------------------------------------- delete ---- */
/* Permanent, and deliberately separate from Archive. Archive is the everyday
   action; this exists for a genuine erasure request, where leaving a hidden
   copy behind would defeat the point. The caller must quote the reference, so
   a stray click on the wrong row cannot destroy an enquiry. */
export async function deleteEnquiry(request, env, id) {
  const user = await requireAdmin(request, env);
  const body = await readJson(request);

  const row = await env.DB.prepare("SELECT id, reference FROM enquiries WHERE id = ?").bind(id).first();
  if (!row) throw notFound("That enquiry no longer exists.");

  if (String(body.confirm || "").trim().toUpperCase() !== row.reference.toUpperCase()) {
    throw badRequest("Type the enquiry reference exactly to confirm deletion.");
  }

  // Attachments first: a row removed before its file leaves the file orphaned
  // in the bucket with nothing left pointing at it.
  const files = await env.DB.prepare("SELECT r2_key FROM enquiry_files WHERE enquiry_id = ?").bind(id).all();
  for (const f of files.results || []) {
    try {
      await env.UPLOADS.delete(f.r2_key);
    } catch (err) {
      console.error("could not delete R2 object", f.r2_key, err);
    }
  }

  // Notes, activity and file rows carry ON DELETE CASCADE, which D1 enforces.
  await env.DB.prepare("DELETE FROM enquiries WHERE id = ?").bind(id).run();

  console.log(`enquiry ${row.reference} permanently deleted by ${user.email}`);
  return adminJson({ ok: true, reference: row.reference, filesRemoved: (files.results || []).length });
}

export { HttpError };
