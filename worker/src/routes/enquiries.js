/* =============================================================================
   PUBLIC ENQUIRY SUBMISSION
   -----------------------------------------------------------------------------
   One multipart request carries the whole enquiry: a JSON `payload` field plus
   any attachments. Doing it in a single call avoids an unauthenticated
   "attach this file to enquiry X" endpoint, which anyone could point at someone
   else's reference number.

   Files go to R2 under a generated key. The customer's filename is kept only as
   a display label; it never becomes part of the storage path.
   ========================================================================== */

import { json, badRequest, tooMany, submitterHash, nowIso } from "../lib/http.js";
import { publicConfig, CONFIG } from "../lib/config.js";
import { validateEnquiry, validateUpload } from "../lib/validate.js";

const MIN_SECONDS_BETWEEN = 60;
const MAX_PER_DAY = 5;

export function getQuoteConfig(request, env) {
  return json(publicConfig(), 200, request, env, {
    // Safe to cache briefly: it changes only on redeploy.
    "Cache-Control": "public, max-age=300",
  });
}

/* YRC-2026-000142. The counter row is bumped atomically and RETURNING gives us
   the new value, so two simultaneous submissions cannot take the same number. */
async function nextReference(env) {
  const year = new Date().getUTCFullYear();
  const row = await env.DB.prepare(
    `INSERT INTO reference_counter (year, last_seq) VALUES (?, 1)
     ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
     RETURNING last_seq`
  ).bind(year).first();
  return `YRC-${year}-${String(row.last_seq).padStart(6, "0")}`;
}

export async function createEnquiry(request, env) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.includes("multipart/form-data")) {
    throw badRequest("Expected a multipart form submission.");
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("That submission could not be read.");
  }

  let payload;
  try {
    payload = JSON.parse(form.get("payload") || "{}");
  } catch {
    throw badRequest("That submission could not be read.");
  }

  const data = validateEnquiry(payload);

  /* ---- flood control, per hashed IP ---- */
  const hash = await submitterHash(request, env.IP_SALT);
  const now = Date.now();
  const recent = await env.DB.prepare(
    `SELECT created_at FROM enquiries WHERE submitter_hash = ? AND created_at > ? ORDER BY created_at DESC`
  ).bind(hash, new Date(now - 86400000).toISOString()).all();
  const posts = recent.results || [];
  if (posts.length >= MAX_PER_DAY) {
    throw tooMany("We have already received several enquiries from you today. Please call us instead.");
  }
  if (posts.length && now - Date.parse(posts[0].created_at) < MIN_SECONDS_BETWEEN * 1000) {
    throw tooMany("Please wait a moment before sending another enquiry.");
  }

  /* ---- attachments, validated before anything is written ---- */
  const files = form.getAll("files").filter((f) => f && typeof f === "object" && "size" in f);
  if (files.length > CONFIG.uploads.maxFiles) {
    throw badRequest(`Please attach no more than ${CONFIG.uploads.maxFiles} files.`);
  }
  const checked = [];
  for (const file of files) checked.push({ file, meta: await validateUpload(file) });

  /* ---- persist ---- */
  const id = crypto.randomUUID();
  const reference = await nextReference(env);
  const created = nowIso();

  await env.DB.prepare(
    `INSERT INTO enquiries (
       id, reference, created_at, updated_at,
       full_name, email, phone, preferred_contact,
       address_line, city, region, postcode, country,
       event_type, event_type_other, event_date, start_time, end_time,
       guest_count, child_guest_count, venue_status, venue_name,
       venue_address, venue_city, venue_region, venue_postcode, venue_country,
       catering_services, catering_services_other, meal_requirements, meal_requirements_other,
       food_style, food_style_other, existing_menu, menu_description,
       dietary_requirements, dietary_details, affected_guest_count,
       event_style, theme_colours,
       approximate_budget, referral_source, additional_information,
       quote_currency,
       status, priority, privacy_consent, privacy_consent_at, source, submitter_hash
     ) VALUES (
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?, ?,
       ?,
       'new', 'normal', 1, ?, 'website', ?
     )`
  ).bind(
    id, reference, created, created,
    data.full_name, data.email, data.phone, data.preferred_contact,
    data.address_line, data.city, data.region, data.postcode, data.country,
    data.event_type, data.event_type_other, data.event_date, data.start_time, data.end_time,
    data.guest_count, data.child_guest_count, data.venue_status, data.venue_name,
    data.venue_address, data.venue_city, data.venue_region, data.venue_postcode, data.venue_country,
    JSON.stringify(data.catering_services), data.catering_services_other,
    JSON.stringify(data.meal_requirements), data.meal_requirements_other,
    data.food_style, data.food_style_other, data.existing_menu, data.menu_description,
    JSON.stringify(data.dietary_requirements), data.dietary_details, data.affected_guest_count,
    JSON.stringify(data.event_style), data.theme_colours,
    data.approximate_budget, data.referral_source, data.additional_information,
    CONFIG.currency.default,
    created, hash
  ).run();

  /* ---- attachments to R2 ---- */
  const stored = [];
  for (const { file, meta } of checked) {
    const fileId = crypto.randomUUID();
    const key = `enquiries/${reference}/${fileId}.${meta.ext}`;
    await env.UPLOADS.put(key, file.stream(), {
      httpMetadata: { contentType: meta.mime },
      customMetadata: { enquiry: reference },
    });
    await env.DB.prepare(
      `INSERT INTO enquiry_files (id, enquiry_id, r2_key, filename, content_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(fileId, id, key, meta.displayName, meta.mime, file.size, nowIso()).run();
    stored.push(meta.displayName);
  }

  await env.DB.prepare(
    `INSERT INTO enquiry_activity (id, enquiry_id, kind, detail, actor, created_at)
     VALUES (?, ?, 'submitted', ?, 'customer', ?)`
  ).bind(
    crypto.randomUUID(), id,
    stored.length ? `Enquiry received with ${stored.length} attachment(s)` : "Enquiry received",
    created
  ).run();

  // Only what the confirmation screen needs. No database id is exposed.
  return json({
    reference,
    first_name: data.full_name.split(/\s+/)[0],
    event_type: data.event_type,
    event_date: data.event_date,
    guest_count: data.guest_count,
    city: data.venue_city || data.city || null,
    catering_services: data.catering_services,
    attachments: stored.length,
  }, 201, request, env);
}
