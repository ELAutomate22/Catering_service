# Yeshua Royal Catering Services — Premium Display Website

*Brand: **Yeshua Royal Catering Services** · Tagline: **Flavours That Reigns** · Royal purple + gold theme.*

A premium, cinematic catering website with a 3D scroll landing experience. The
site itself is plain HTML, CSS and JavaScript — **no build step, no npm**. Just
open `index.html` (or upload the folder to any host) and it works. GSAP is
vendored as a plain file in `js/vendor/`, so there is still nothing to install
or compile.

The one moving part is the **star reviews** section, which stores visitor
reviews in a Cloudflare D1 database via the Worker in `worker/`. Until that
Worker is deployed and its URL is set in `js/config.js`, the reviews section
simply shows its empty state — the rest of the site is unaffected.

> This site is for **presentation and credibility only**. Visitors contact the
> business in exactly two ways: **calling the phone number** or **opening the
> Instagram profile**. There is intentionally **no** ordering, cart, checkout,
> booking, reservation, payment, enquiry form, contact form or WhatsApp.

---

## 🚀 Quick start

1. Open the folder `catering services website`.
2. Double-click **`index.html`** to preview in your browser.
   *(For the smoothest experience, serve it locally — see “Run a local server”.)*

---

## ✏️ Make it yours (only 1 file to edit)

Open **`js/config.js`** and replace every value marked `// ← REPLACE`.
Everything on the site — hero text, all “Call Us” buttons, all “View Instagram”
buttons, the footer and contact section — updates automatically from this one file:

| What | Where in `config.js` |
|------|------------------------|
| Business name | `brand.name` |
| Phone (shown) | `contact.phoneDisplay` |
| Phone (for the call link) | `contact.phoneHref` (digits only, e.g. `+40712345678`) |
| Instagram profile URL | `contact.instagramUrl` |
| Instagram @handle | `contact.instagramHandle` |
| City / location | `contact.location` |
| Service area | `contact.serviceArea` |
| Hero headline & subtext | `hero.headline`, `hero.sub` |
| About text & stats | `about.*` |
| Services / Menus / Events / Testimonials | the matching arrays |

## 🖼️ Add your logo

Save your supplied logo artwork as **`assets/logo/logo.png`** — the site is
already wired to use it and will swap it in automatically. Until that file
exists, an on-brand vector emblem (`logo.svg`) is shown as a stand-in.
- A **transparent background** looks best (the white-background version shows a
  white square on the dark hero header). Ask and a transparent cut-out can be made.

## 📸 Add your food photos

Drop your images into **`assets/images/`** using the exact file names listed in
`assets/images/README.txt`. Until you do, the site shows **elegant designed
placeholders** (warm gradient panels with captions) — nothing looks broken.

- Recommended size: ~1600px on the long edge, JPG, optimised for web.
- Every image already has descriptive `alt` text for accessibility/SEO.

---

## 🖥️ Run a local server (optional, recommended)

Some browsers restrict features when opening files directly. To serve locally:

```bash
# Python 3
python -m http.server 5500
# then open http://localhost:5500
```

or with Node:

```bash
npx serve .
```

---

## 📂 Structure

```
catering services website/
├── index.html          # all sections (semantic HTML)
├── css/styles.css       # design system + responsive + placeholder styling
├── js/
│   ├── config.js        # ← EDIT THIS (brand, phone, Instagram, content)
│   ├── main.js          # binding, rendering, 3D scroll engine, lightbox
│   ├── reviews.js       # star reviews: modal, average, talks to the Worker
│   ├── photo-letter-scatter.js  # hover letter-scatter on every photo
│   └── vendor/gsap.min.js       # GSAP 3.13.0, vendored (no build step)
├── worker/              # reviews API — Cloudflare Worker + D1 (see its README)
├── assets/
│   ├── logo/logo.svg    # ← replace with your logo
│   └── images/          # ← drop your photos here (see README.txt inside)
└── README.md
```

## ✨ Photo hover effect

Hovering any real photo scatters its caption into single characters around the
image while the photo zooms inside a slightly shrinking frame. It is wired to
`figure.media`, the markup the site already uses for photography and never for
logos or icons, so new photos get it automatically.

- Caption source, in order: `data-scatter-text`, then `data-label`, then `alt`.
- Opt a photo out with `data-no-letter-scatter`.
- Tuning constants (spread, zoom, durations, stagger) sit at the top of
  `js/photo-letter-scatter.js`.
- Skipped entirely on touch screens and for visitors who prefer reduced motion;
  both fall back to the site's original CSS hover zoom.

## 🎨 Re-theming (colours & fonts)

All colours live at the top of `css/styles.css` under `:root`. Change
`--gold`, `--green`, `--ink`, etc. to restyle the entire site. Fonts are set via
`--serif` and `--sans`.

## ✅ What this site deliberately does NOT include

No online ordering · no cart · no checkout · no payment · no booking · no
reservation · no contact/enquiry form · no “Order/Book/Reserve” buttons · no
WhatsApp. Contact is by **phone** and **Instagram** only, as required. The star
reviews are the only place a visitor submits anything.
