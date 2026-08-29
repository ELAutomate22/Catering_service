/* =============================================================================
   QUOTE FORM CONFIGURATION — the single source of truth
   -----------------------------------------------------------------------------
   Every option list lives here once. The Worker validates against it, and the
   public form fetches it from GET /api/quote/config and renders itself from the
   result, so the two can never drift apart.

   To add, rename, disable or reorder an option, edit it here and redeploy the
   Worker. Nothing in the website needs changing.

   `enabled: false` hides an option from the form but keeps it valid on existing
   enquiries, so turning a service off never corrupts records that already
   reference it.
   ========================================================================== */

const on = (value, label, enabled = true) => ({ value, label, enabled });

export const CONFIG = {
  currency: { default: "EUR", options: ["EUR", "RON", "GBP", "USD"] },

  preferredContact: [
    on("phone", "Phone"),
    on("email", "Email"),
    on("whatsapp", "WhatsApp"),
  ],

  countries: [
    on("RO", "Romania"),
    on("GB", "United Kingdom"),
    on("IE", "Ireland"),
    on("MD", "Moldova"),
    on("DE", "Germany"),
    on("FR", "France"),
    on("IT", "Italy"),
    on("ES", "Spain"),
    on("AT", "Austria"),
    on("BE", "Belgium"),
    on("NL", "Netherlands"),
    on("OTHER", "Other"),
  ],
  defaultCountry: "RO",

  eventTypes: [
    on("wedding", "Wedding"),
    on("birthday", "Birthday"),
    on("anniversary", "Anniversary"),
    on("christening", "Christening / Baptism"),
    on("engagement", "Engagement"),
    on("private_party", "Private Party"),
    on("corporate", "Corporate Event"),
    on("business_meeting", "Business Meeting"),
    on("conference", "Conference"),
    on("religious", "Religious Celebration"),
    on("family", "Family Gathering"),
    on("memorial", "Funeral / Memorial Catering"),
    on("other", "Other"),
  ],

  venueStatuses: [
    on("booked", "Venue already booked"),
    on("chosen", "Venue chosen but not booked"),
    on("looking", "Still looking for a venue"),
    on("home", "Event at home / private property"),
    on("other", "Other"),
  ],

  cateringServices: [
    on("full_event", "Full Event Catering"),
    on("buffet", "Buffet Catering"),
    on("plated", "Plated / Seated Meal"),
    on("canapes", "Canapés / Finger Food"),
    on("traditional", "Traditional Catering"),
    on("corporate", "Corporate Catering"),
    on("private_dining", "Private Dining"),
    on("bbq", "BBQ / Outdoor Catering"),
    on("desserts", "Desserts"),
    on("cakes", "Cakes"),
    on("drinks", "Drinks / Refreshments"),
    on("other", "Other"),
  ],

  mealRequirements: [
    on("welcome_drinks", "Welcome drinks"),
    on("canapes", "Canapés"),
    on("starter", "Starter"),
    on("main", "Main course"),
    on("sides", "Side dishes"),
    on("dessert", "Dessert"),
    on("late_night", "Late-night food"),
    on("cake", "Cake"),
    on("soft_drinks", "Soft drinks"),
    on("hot_drinks", "Hot drinks"),
    on("other", "Other"),
  ],

  foodStyles: [
    on("romanian", "Traditional Romanian"),
    on("international", "International"),
    on("modern_european", "Modern European"),
    on("mediterranean", "Mediterranean"),
    on("african", "African"),
    on("fusion", "Mixed / Fusion"),
    on("no_preference", "No preference"),
    on("other", "Other"),
  ],

  menuAnswers: [
    on("yes", "Yes"),
    on("no", "No"),
    on("recommendations", "I would like recommendations"),
  ],

  dietaryRequirements: [
    on("none", "None"),
    on("vegetarian", "Vegetarian"),
    on("vegan", "Vegan"),
    on("gluten_free", "Gluten-free"),
    on("dairy_free", "Dairy-free"),
    on("nut_allergy", "Nut allergy"),
    on("halal", "Halal"),
    on("kosher", "Kosher"),
    on("other_allergy", "Other allergies"),
    on("other_dietary", "Other dietary requirements"),
  ],

  // Flip `enabled` to false for anything the business does not offer. The form
  // stops showing it immediately; existing enquiries keep rendering it.
  additionalServices: [
    on("serving_staff", "Serving staff"),
    on("chefs", "Chefs on-site"),
    on("table_service", "Table service"),
    on("buffet_setup", "Buffet setup"),
    on("styling", "Food presentation / styling"),
    on("plates_cutlery", "Plates and cutlery"),
    on("glassware", "Glassware"),
    on("tables", "Tables"),
    on("chairs", "Chairs"),
    on("linen", "Table linen"),
    on("decorations", "Decorations"),
    on("delivery_only", "Delivery only"),
    on("setup_cleanup", "Setup and cleanup"),
    on("cake_service", "Cake service"),
    on("advise", "Unsure — please advise"),
    on("other", "Other"),
  ],

  eventStyles: [
    on("elegant", "Elegant / Luxury"),
    on("traditional", "Traditional"),
    on("modern", "Modern"),
    on("rustic", "Rustic"),
    on("formal", "Formal"),
    on("relaxed", "Relaxed"),
    on("corporate", "Corporate"),
    on("outdoor", "Outdoor"),
    on("themed", "Themed"),
    on("unsure", "Not sure yet"),
  ],

  budgets: [
    on("under_500", "Under €500"),
    on("500_1000", "€500 – €1,000"),
    on("1000_2500", "€1,000 – €2,500"),
    on("2500_5000", "€2,500 – €5,000"),
    on("5000_10000", "€5,000 – €10,000"),
    on("over_10000", "€10,000+"),
    on("unsure", "Not sure yet"),
    on("private", "Prefer not to say"),
  ],

  referralSources: [
    on("instagram", "Instagram"),
    on("facebook", "Facebook"),
    on("tiktok", "TikTok"),
    on("google", "Google"),
    on("recommendation", "Recommendation"),
    on("previous_customer", "Previous customer"),
    on("event", "Event attended"),
    on("other", "Other"),
  ],

  // Admin-side vocabularies
  statuses: [
    on("new", "New"),
    on("reviewing", "Reviewing"),
    on("contacted", "Contacted"),
    on("quote_preparing", "Quote preparing"),
    on("quote_sent", "Quote sent"),
    on("awaiting_response", "Awaiting response"),
    on("confirmed", "Confirmed"),
    on("declined", "Declined"),
    on("cancelled", "Cancelled"),
  ],

  priorities: [
    on("normal", "Normal"),
    on("high", "High priority"),
    on("urgent", "Urgent"),
  ],

  uploads: {
    maxFiles: 5,
    maxBytes: 8 * 1024 * 1024, // 8 MB each
    // Extension and MIME are both checked; nothing executable is accepted.
    accept: [
      { ext: "jpg",  mime: "image/jpeg" },
      { ext: "jpeg", mime: "image/jpeg" },
      { ext: "png",  mime: "image/png" },
      { ext: "webp", mime: "image/webp" },
      { ext: "pdf",  mime: "application/pdf" },
    ],
  },

  limits: {
    shortText: 200,
    mediumText: 600,
    longText: 4000,
    maxGuests: 100000,
    // How far ahead an event may realistically be booked.
    maxEventYearsAhead: 5,
  },
};

/* Values a submission may legitimately contain — includes disabled options so
   that turning a service off never invalidates an enquiry already holding it. */
export const valuesOf = (list) => new Set(list.map((o) => o.value));

/* What the public form is allowed to see: enabled options only, and none of
   the admin vocabularies. */
export function publicConfig() {
  const strip = (list) =>
    list.filter((o) => o.enabled).map(({ value, label }) => ({ value, label }));

  return {
    preferredContact: strip(CONFIG.preferredContact),
    countries: strip(CONFIG.countries),
    defaultCountry: CONFIG.defaultCountry,
    eventTypes: strip(CONFIG.eventTypes),
    venueStatuses: strip(CONFIG.venueStatuses),
    cateringServices: strip(CONFIG.cateringServices),
    mealRequirements: strip(CONFIG.mealRequirements),
    foodStyles: strip(CONFIG.foodStyles),
    menuAnswers: strip(CONFIG.menuAnswers),
    dietaryRequirements: strip(CONFIG.dietaryRequirements),
    additionalServices: strip(CONFIG.additionalServices),
    eventStyles: strip(CONFIG.eventStyles),
    budgets: strip(CONFIG.budgets),
    referralSources: strip(CONFIG.referralSources),
    uploads: {
      maxFiles: CONFIG.uploads.maxFiles,
      maxBytes: CONFIG.uploads.maxBytes,
      accept: CONFIG.uploads.accept.map((a) => a.ext),
      acceptMime: CONFIG.uploads.accept.map((a) => a.mime),
    },
    limits: CONFIG.limits,
  };
}

/* Labels for rendering stored values back in the admin UI. */
export function labelFor(list, value) {
  const hit = list.find((o) => o.value === value);
  return hit ? hit.label : value;
}
