# Reviews API — Cloudflare Worker + D1

The star reviews on the site are stored in a Cloudflare D1 database. The browser
never talks to the database directly; it calls this Worker, which is the only
thing holding the keys.

```
index.html  →  js/reviews.js  →  Worker (/api/reviews)  →  D1 (yeshua-reviews)
```

| Route | Does |
|---|---|
| `GET /api/reviews` | Returns approved reviews, newest first, max 100 |
| `POST /api/reviews` | Validates, flood-checks, stores, returns the new review |

There is no update or delete route on purpose. Hiding or removing a review is
done by the owner in the Cloudflare dashboard, never over the internet.

## Setup

The database has already been created and `wrangler.jsonc` already points at it
(`database_id a35dece6-…`), with `ALLOWED_ORIGINS` set to the live Netlify site.
What remains, run from this `worker/` folder:

```bash
npm install
```

Create the table in the real (remote) database — skipping this is what produces
`no such table: catering_reviews`:

```bash
npm run db:init
```

Set the salt used to hash visitor IPs (any long random string — it is never
shown to anyone, and changing it later just resets flood counters):

```bash
npx wrangler secret put IP_SALT
```

Deploy:

```bash
npm run deploy
```

Wrangler prints the live URL, e.g. `https://yeshua-reviews-api.<you>.workers.dev`.
Put that in `js/config.js` → `reviewsApi.url`, then redeploy the website itself
so Netlify serves the updated `config.js`.

### A note on the binding name

`wrangler d1 create` suggests `"binding": "yeshua_reviews"`. This project uses
`"binding": "DB"` instead, which is what `src/index.js` reads (`env.DB`). Leave
it as `DB` — renaming it breaks the Worker.

## Working locally

`--local` runs a real D1 in-process; no Cloudflare account needed.

```bash
npm run db:init:local
```

```bash
npx wrangler dev --local
```

Point `js/config.js` → `reviewsApi.url` at `http://127.0.0.1:8787` while testing,
and set it back before deploying the site. Note that `ALLOWED_ORIGINS` is now
pinned to the Netlify domain, so a browser on `localhost` will be refused —
temporarily add your local origin to it when testing through the browser.

## Moderating reviews

Reviews go live the moment they are posted. To hide one without deleting it:

```bash
npx wrangler d1 execute yeshua-reviews --remote --command "UPDATE catering_reviews SET approved = 0 WHERE name = 'Someone';"
```

To read what has come in:

```bash
npx wrangler d1 execute yeshua-reviews --remote --command "SELECT created_at, name, rating, quote FROM catering_reviews ORDER BY created_at DESC;"
```

The same table is browsable in the dashboard under **Storage & Databases → D1**.

## What `ALLOWED_ORIGINS` does and does not do

It stops **other websites** from using this endpoint inside a visitor's browser:
the browser refuses the response when the origin is not on the list. It does
**not** stop a script — anyone running `curl` can post regardless, because CORS
is enforced by browsers, not by the server. The controls that actually limit
abuse are the input validation and the flood control below. If reviews ever
start attracting junk, the next step is a Cloudflare Turnstile check on the
form.

## Flood control

Per hashed IP: at most 3 reviews a day, and at least 60 seconds between posts.
Adjust `MAX_POSTS_PER_DAY` / `MIN_SECONDS_BETWEEN_POSTS` at the top of
`src/index.js`. Only a salted SHA-256 of the address is stored — the raw IP is
never written to the database.
