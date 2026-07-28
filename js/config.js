/* =============================================================================
   SAVORÉ — SITE CONFIGURATION
   -----------------------------------------------------------------------------
   THIS IS THE ONLY FILE YOU NEED TO EDIT TO GO LIVE.
   Replace every value marked  // ← REPLACE  with your real business details.
   Everything on the website (hero, contact section, footer, buttons) reads
   from here, so you only change things in ONE place.
   ========================================================================== */

window.SITE_CONFIG = {

  /* -- BRAND ---------------------------------------------------------------- */
  brand: {
    name: "Yeshua Royal Catering Services",
    short: "Yeshua Royal",
    tagline: "Flavours That Reigns",
  },

  /* -- CONTACT (used by every phone + Instagram button on the site) --------- */
  contact: {
    // Both numbers appear in the Contact section and Footer. The primary
    // (first) number is used by the "Call Us" buttons in the hero + header.
    phones: [
      { display: "+44 7773 556005", href: "+447773556005" },
      { display: "+44 7534 634714", href: "+447534634714" },
    ],
    // primary phone (single-button spots: hero + header "Call Us")
    phoneDisplay: "+44 7773 556005",
    phoneHref: "+447773556005",
    instagramUrl: "https://www.instagram.com/yeshua.royal.catering/",
    instagramHandle: "@yeshua.royal.catering",
    location: "United Kingdom",                 // ← confirm / adjust your city
    serviceArea: "Available for events across the UK", // ← confirm / adjust your service area
  },

  /* -- HERO (top of the page) ---------------------------------------------- */
  hero: {
    eyebrow: "Private Events · Weddings · Corporate",
    headline: "Elegant Catering for Unforgettable Moments",
    sub: "Beautifully presented food, crafted for private events, weddings, celebrations, and corporate occasions.",
  },

  /* -- ABOUT --------------------------------------------------------------- */
  about: {
    eyebrow: "Our Story",
    heading: "Beautiful food, thoughtfully presented",
    body: [
      "We are a catering studio built around one belief: that great food should look as considered as it tastes. Every menu is prepared with fresh, seasonal ingredients and finished with the kind of detail your guests remember.",
      "From intimate gatherings to grand celebrations, we handle the presentation, the plating and the pacing — so your occasion feels effortless, elegant, and entirely your own.",
    ],
    stats: [
      { value: "10+", label: "Years of experience" },
      { value: "500+", label: "Events catered" },
      { value: "100%", label: "Fresh, seasonal produce" },
    ],
  },

  /* -- SERVICES (informative cards only) ----------------------------------- */
  services: [
    { icon: "rings",   title: "Wedding Catering",     desc: "Refined menus and elegant plating designed around your celebration, from the first canapé to the final toast." },
    { icon: "sparkle", title: "Private Events",       desc: "Intimate dinners and private gatherings, catered with warmth, precision and quiet luxury." },
    { icon: "briefcase", title: "Corporate Catering", desc: "Polished catering for meetings, launches and company celebrations that make the right impression." },
    { icon: "cake",    title: "Birthday Celebrations", desc: "Joyful, generous spreads and showpiece platters for milestone birthdays and family parties." },
    { icon: "buffet",  title: "Buffet Catering",      desc: "Abundant, beautifully styled buffets with seasonal dishes for every kind of gathering." },
    { icon: "platter", title: "Luxury Platters",      desc: "Grazing boards and sharing platters, arranged as centrepieces that look as good as they taste." },
    { icon: "canape",  title: "Starters & Canapés",   desc: "Hand-finished canapés, samosas and pastry bites, styled to match the mood of your event." },
    { icon: "menu",    title: "Custom Menus",         desc: "Bespoke menus tailored to your theme, dietary needs and personal taste — created just for you." },
  ],

  /* -- MENU / FOOD SHOWCASE (display only — no ordering) -------------------- */
  menu: [
    // "images" (plural) stacks two photos inside one card, each with its own hover zoom
    { images: ["menu-starters-1.jpg", "menu-starters-2.jpg"], title: "Starters", desc: "Elegant canapés and refined first courses.", items: ["Canapés", "Bruschetta", "Seasonal soups"] },
    { images: ["menu-mains-1.jpg", "menu-mains-2.jpg"], title: "Main Dishes", desc: "Considered mains built on seasonal produce.", items: ["Slow-roasted meats", "Fresh fish", "Vegetarian"] },
    { image: "menu-platters.jpg",  title: "Platters",     desc: "Sharing boards styled as centrepieces.",       items: ["Charcuterie", "Cheese", "Mezze"] },
    { image: "menu-buffets.jpg",   title: "Event Buffets", desc: "Generous buffets for larger celebrations.",    items: ["Hot & cold", "Grazing", "Live stations"] },
  ],

  /* -- EVENTS (display only) ----------------------------------------------- */
  events: [
    { image: "event-weddings.jpg",   title: "Weddings",            desc: "From ceremony to celebration." },
    { image: "event-christenings.jpg", title: "Christenings",       desc: "Warm, family-centred gatherings." },
    { image: "event-birthdays.jpg",  title: "Birthdays",           desc: "Milestones worth remembering." },
    { image: "event-corporate.jpg",  title: "Corporate Events",    desc: "Polished and professional." },
    { image: "event-family.jpg",     title: "Family Celebrations", desc: "Generous food for the people you love." },
    { image: "event-private.jpg",    title: "Private Parties",     desc: "Intimate and beautifully catered." },
    { image: "event-outdoor.jpg",    title: "Outdoor Events",      desc: "Garden parties and open-air feasts." },
  ],

  /* -- GALLERY (drop your photos into /assets/images with these names) ------ */
  gallery: [
    { image: "gallery-01.jpg", label: "Plated main course",   size: "tall"  },
    { image: "gallery-02.jpg", label: "Canapé selection",     size: "wide"  },
    { image: "gallery-03.jpg", label: "Starters table",       size: ""      },
    { image: "gallery-04.jpg", label: "Grazing platter",      size: ""      },
    { image: "gallery-05.jpg", label: "Wedding styling",      size: "tall"  },
    { image: "gallery-06.jpg", label: "Buffet display",       size: "wide"  },
    { image: "gallery-07.jpg", label: "Fresh ingredients",    size: ""      },
    { image: "gallery-08.jpg", label: "Event setup",          size: ""      },
    { image: "gallery-09.jpg", label: "Signature dish",       size: "tall"  },
    { image: "gallery-10.jpg", label: "Platter selection",    size: "wide"  },
  ],

  /* -- TESTIMONIALS (placeholder, believable — edit freely) ---------------- */
  testimonials: [
    { quote: "The food was beautifully presented and every guest commented on the quality. Everything felt organised, elegant, and stress-free.", name: "Andreea & Mihai", role: "Wedding" },
    { quote: "Professional from start to finish. The team understood exactly the tone we wanted and the buffet looked stunning.", name: "Elena P.", role: "Corporate event" },
    { quote: "Fresh, generous and thoughtfully plated. Our guests are still talking about the grazing platters.", name: "Radu M.", role: "50th birthday" },
    { quote: "Calm, attentive and genuinely lovely to work with. The presentation was flawless and the flavours were exceptional.", name: "Sofia I.", role: "Private dinner" },
  ],

  /* -- INSTAGRAM SECTION --------------------------------------------------- */
  instagram: {
    heading: "See Our Latest Creations on Instagram",
    body: "See more of our food presentation, events, and catering work on Instagram.",
    // Optional post preview tiles — empty while there are no posts yet.
    // Add filenames here (and restore the grid div in index.html) to show them.
    tiles: [],
  },
};
