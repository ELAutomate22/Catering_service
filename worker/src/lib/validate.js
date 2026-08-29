/* =============================================================================
   SERVER-SIDE VALIDATION for a submitted enquiry.
   -----------------------------------------------------------------------------
   The browser validates too, for a decent experience — but that is a courtesy,
   not a control. Nothing reaches the database without passing through here, and
   every option value is checked against config.js rather than trusted.
   ========================================================================== */

import { CONFIG, valuesOf } from "./config.js";
import { badRequest } from "./http.js";

const L = CONFIG.limits;

const str = (v) => (typeof v === "string" ? v.trim() : "");

function text(value, field, { required = false, max = L.shortText, label } = {}) {
  const v = str(value);
  if (!v) {
    if (required) throw badRequest(`${label} is required.`, field);
    return null;
  }
  if (v.length > max) throw badRequest(`${label} is too long (max ${max} characters).`, field);
  return v;
}

function pick(value, list, field, { required = false, label } = {}) {
  const v = str(value);
  if (!v) {
    if (required) throw badRequest(`${label} is required.`, field);
    return null;
  }
  if (!valuesOf(list).has(v)) throw badRequest(`That is not a valid ${label.toLowerCase()}.`, field);
  return v;
}

function many(value, list, field, { required = false, label } = {}) {
  if (value == null) value = [];
  if (!Array.isArray(value)) throw badRequest(`${label} is not in the expected format.`, field);
  if (value.length > list.length) throw badRequest(`Too many ${label.toLowerCase()} selected.`, field);
  const allowed = valuesOf(list);
  const out = [];
  for (const raw of value) {
    const v = str(raw);
    if (!allowed.has(v)) throw badRequest(`That is not a valid ${label.toLowerCase()} option.`, field);
    if (!out.includes(v)) out.push(v);
  }
  if (required && !out.length) throw badRequest(`Please choose at least one ${label.toLowerCase()} option.`, field);
  return out;
}

function wholeNumber(value, field, { required = false, min = 0, max = L.maxGuests, label } = {}) {
  if (value === "" || value == null) {
    if (required) throw badRequest(`${label} is required.`, field);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n)) throw badRequest(`${label} must be a whole number.`, field);
  if (n < min) throw badRequest(`${label} must be at least ${min}.`, field);
  if (n > max) throw badRequest(`${label} looks too large — please contact us directly.`, field);
  return n;
}

/* Dates are compared as calendar days in UTC, so "today" is still accepted
   regardless of the visitor's timezone. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function isoDate(value, field, { required = false, notPast = false, label } = {}) {
  const v = str(value);
  if (!v) {
    if (required) throw badRequest(`${label} is required.`, field);
    return null;
  }
  if (!DAY.test(v)) throw badRequest(`${label} is not a valid date.`, field);
  const t = Date.parse(v + "T00:00:00Z");
  if (Number.isNaN(t)) throw badRequest(`${label} is not a valid date.`, field);

  // Reject dates the calendar does not actually have (e.g. 2026-02-31).
  const d = new Date(t);
  if (d.toISOString().slice(0, 10) !== v) throw badRequest(`${label} is not a real date.`, field);

  if (notPast) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    if (t < todayUtc) throw badRequest(`${label} cannot be in the past.`, field);
    const limit = new Date(todayUtc);
    limit.setUTCFullYear(limit.getUTCFullYear() + L.maxEventYearsAhead);
    if (t > limit.getTime()) throw badRequest(`${label} is too far ahead — please contact us directly.`, field);
  }
  return v;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function clockTime(value, field, label) {
  const v = str(value);
  if (!v) return null;
  if (!TIME.test(v)) throw badRequest(`${label} is not a valid time.`, field);
  return v;
}

/* Deliberately permissive: the goal is to catch typos, not to police the many
   legitimate shapes an address can take. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function email(value, field) {
  const v = str(value).toLowerCase();
  if (!v) throw badRequest("Email address is required.", field);
  if (v.length > 160 || !EMAIL.test(v)) throw badRequest("That email address does not look right.", field);
  return v;
}

/* International-friendly: digits, with optional leading + and separators. */
function phone(value, field) {
  const v = str(value);
  if (!v) throw badRequest("Phone number is required.", field);
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length < 6 || digits.length > 20 || !/^\+?[\d\s().-]+$/.test(v)) {
    throw badRequest("That phone number does not look right.", field);
  }
  return v;
}

/* ---------------------------------------------------------------- the form */
export function validateEnquiry(body) {
  if (!body || typeof body !== "object") throw badRequest("Expected a JSON body.");

  // Honeypot: a field hidden from people, irresistible to naive bots. Anything
  // in it means the submission is discarded.
  if (str(body.website)) throw badRequest("Sorry — that submission could not be accepted.");

  if (body.privacy_consent !== true) {
    throw badRequest("Please agree to the privacy statement so we can reply to you.", "privacy_consent");
  }

  const eventType = pick(body.event_type, CONFIG.eventTypes, "event_type", { required: true, label: "Event type" });
  const cateringServices = many(body.catering_services, CONFIG.cateringServices, "catering_services", { required: true, label: "Catering service" });
  const dietary = many(body.dietary_requirements, CONFIG.dietaryRequirements, "dietary_requirements", { label: "Dietary requirement" });
  const foodStyle = pick(body.food_style, CONFIG.foodStyles, "food_style", { label: "Food style" });
  const additional = many(body.additional_services, CONFIG.additionalServices, "additional_services", { label: "Additional service" });

  const dietaryBeyondNone = dietary.some((d) => d !== "none");

  return {
    // customer
    full_name: text(body.full_name, "full_name", { required: true, max: 120, label: "Full name" }),
    email: email(body.email, "email"),
    phone: phone(body.phone, "phone"),
    preferred_contact: pick(body.preferred_contact, CONFIG.preferredContact, "preferred_contact", { label: "Preferred contact method" }),
    address_line: text(body.address_line, "address_line", { label: "Address" }),
    city: text(body.city, "city", { label: "City" }),
    region: text(body.region, "region", { label: "County or region" }),
    postcode: text(body.postcode, "postcode", { max: 20, label: "Postcode" }),
    country: pick(body.country, CONFIG.countries, "country", { label: "Country" }),

    // event
    event_type: eventType,
    event_type_other: eventType === "other"
      ? text(body.event_type_other, "event_type_other", { required: true, max: L.mediumText, label: "Event description" })
      : null,
    event_date: isoDate(body.event_date, "event_date", { required: true, notPast: true, label: "Event date" }),
    start_time: clockTime(body.start_time, "start_time", "Start time"),
    end_time: clockTime(body.end_time, "end_time", "End time"),
    guest_count: wholeNumber(body.guest_count, "guest_count", { required: true, min: 1, label: "Number of guests" }),
    child_guest_count: wholeNumber(body.child_guest_count, "child_guest_count", { min: 0, label: "Number of children" }),
    venue_status: pick(body.venue_status, CONFIG.venueStatuses, "venue_status", { label: "Venue status" }),
    venue_name: text(body.venue_name, "venue_name", { label: "Venue name" }),
    venue_address: text(body.venue_address, "venue_address", { label: "Venue address" }),
    venue_city: text(body.venue_city, "venue_city", { label: "Venue city" }),
    venue_region: text(body.venue_region, "venue_region", { label: "Venue region" }),
    venue_postcode: text(body.venue_postcode, "venue_postcode", { max: 20, label: "Venue postcode" }),
    venue_country: pick(body.venue_country, CONFIG.countries, "venue_country", { label: "Venue country" }),

    // catering
    catering_services: cateringServices,
    catering_services_other: cateringServices.includes("other")
      ? text(body.catering_services_other, "catering_services_other", { required: true, max: L.mediumText, label: "Catering description" })
      : null,
    meal_requirements: many(body.meal_requirements, CONFIG.mealRequirements, "meal_requirements", { label: "Meal requirement" }),
    meal_requirements_other: text(body.meal_requirements_other, "meal_requirements_other", { max: L.mediumText, label: "Meal requirement detail" }),
    food_style: foodStyle,
    food_style_other: foodStyle === "other"
      ? text(body.food_style_other, "food_style_other", { required: true, max: L.mediumText, label: "Food style description" })
      : null,
    existing_menu: pick(body.existing_menu, CONFIG.menuAnswers, "existing_menu", { label: "Menu answer" }),
    menu_description: body.existing_menu === "yes"
      ? text(body.menu_description, "menu_description", { required: true, max: L.longText, label: "Menu details" })
      : text(body.menu_description, "menu_description", { max: L.longText, label: "Menu details" }),

    // dietary — details become required once anything beyond "None" is ticked
    dietary_requirements: dietary,
    dietary_details: dietaryBeyondNone
      ? text(body.dietary_details, "dietary_details", { required: true, max: L.longText, label: "Dietary details" })
      : null,
    affected_guest_count: dietaryBeyondNone
      ? wholeNumber(body.affected_guest_count, "affected_guest_count", { min: 0, label: "Guests affected" })
      : null,

    // services + style
    additional_services: additional,
    additional_services_other: additional.includes("other")
      ? text(body.additional_services_other, "additional_services_other", { required: true, max: L.mediumText, label: "Additional service description" })
      : null,
    event_style: many(body.event_style, CONFIG.eventStyles, "event_style", { label: "Event style" }),
    theme_colours: text(body.theme_colours, "theme_colours", { label: "Theme or colours" }),

    // commercial + provenance
    approximate_budget: pick(body.approximate_budget, CONFIG.budgets, "approximate_budget", { label: "Budget" }),
    referral_source: pick(body.referral_source, CONFIG.referralSources, "referral_source", { label: "Referral source" }),
    additional_information: text(body.additional_information, "additional_information", { max: L.longText, label: "Additional information" }),
  };
}

/* Uploads are checked on extension AND sniffed magic bytes, because a
   Content-Type header is attacker-controlled and an extension is just a name. */
export async function validateUpload(file) {
  const { maxBytes, accept } = CONFIG.uploads;
  const name = String(file.name || "file");
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const match = accept.find((a) => a.ext === ext);

  if (!match) throw badRequest(`"${name}" is not an accepted file type.`);
  if (file.size > maxBytes) throw badRequest(`"${name}" is larger than ${Math.round(maxBytes / 1048576)} MB.`);
  if (file.size === 0) throw badRequest(`"${name}" is empty.`);

  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const starts = (...bytes) => bytes.every((b, i) => head[i] === b);

  const looksLike =
    (match.mime === "image/jpeg" && starts(0xff, 0xd8, 0xff)) ||
    (match.mime === "image/png" && starts(0x89, 0x50, 0x4e, 0x47)) ||
    (match.mime === "application/pdf" && starts(0x25, 0x50, 0x44, 0x46)) ||
    (match.mime === "image/webp" && starts(0x52, 0x49, 0x46, 0x46) &&
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50);

  if (!looksLike) throw badRequest(`"${name}" does not look like a real ${ext.toUpperCase()} file.`);

  // The stored name is generated, never taken from the upload, so a crafted
  // filename cannot traverse paths or smuggle an extension.
  return { ext, mime: match.mime, displayName: name.slice(-120) };
}
