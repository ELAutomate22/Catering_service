/* =============================================================================
   YESHUA ROYAL CATERING — Worker entry point
   -----------------------------------------------------------------------------
   Three surfaces on one Worker:

     /api/reviews          public, CORS, called by the Netlify site
     /api/quote/*          public, CORS, called by the Netlify site
     /admin, /api/admin/*  private, same-origin, session-cookie protected

   The admin app is served from here rather than from the website because the
   two live on different registrable domains. A session cookie set by this
   Worker would be a third-party cookie to the Netlify site — blocked outright
   by Safari and being phased out in Chrome. Serving the admin UI from the same
   origin as its API makes an HttpOnly + SameSite=Strict cookie work properly
   everywhere, and keeps the admin surface off the public marketing site.
   ========================================================================== */

import { json, adminJson, corsHeaders, HttpError, notFound } from "./lib/http.js";
import { listReviews, createReview } from "./routes/reviews.js";
import { getQuoteConfig, createEnquiry } from "./routes/enquiries.js";
import * as admin from "./routes/admin.js";
import { adminPage } from "./admin-app.js";

const isAdminPath = (p) => p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/");

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;

  /* ---------------------------------------------------------- admin app --- */
  if (path === "/admin") {
    return new Response(adminPage(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        // The admin app is entirely self-contained: no third-party scripts,
        // no external requests, nothing to inject a payload through.
        "Content-Security-Policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
          "img-src 'self' data:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
      },
    });
  }

  /* --------------------------------------------------------- admin API ---- */
  if (path.startsWith("/api/admin/")) {
    const rest = path.slice("/api/admin/".length);

    if (rest === "login" && method === "POST") return admin.postLogin(request, env);
    if (rest === "logout" && method === "POST") return admin.postLogout(request, env);
    if (rest === "me" && method === "GET") return admin.getMe(request, env);
    if (rest === "dashboard" && method === "GET") return admin.getDashboard(request, env);
    if (rest === "enquiries" && method === "GET") return admin.listEnquiries(request, env);

    let m;
    if ((m = rest.match(/^enquiries\/([0-9a-f-]{36})$/))) {
      if (method === "GET") return admin.getEnquiry(request, env, m[1]);
      if (method === "PATCH") return admin.patchEnquiry(request, env, m[1]);
      if (method === "DELETE") return admin.deleteEnquiry(request, env, m[1]);
    }
    if ((m = rest.match(/^enquiries\/([0-9a-f-]{36})\/notes$/)) && method === "POST") {
      return admin.addNote(request, env, m[1]);
    }
    if ((m = rest.match(/^files\/([0-9a-f-]{36})$/)) && method === "GET") {
      return admin.downloadFile(request, env, m[1]);
    }
    throw notFound();
  }

  /* ------------------------------------------------------------- public --- */
  if (path === "/api/reviews") {
    if (method === "GET") return listReviews(request, env);
    if (method === "POST") return createReview(request, env);
    throw new HttpError(405, "Method not allowed");
  }

  if (path === "/api/quote/config" && method === "GET") return getQuoteConfig(request, env);

  if (path === "/api/quote/enquiries") {
    if (method === "POST") return createEnquiry(request, env);
    throw new HttpError(405, "Method not allowed");
  }

  throw notFound();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Preflight only matters for the public, cross-origin surface.
    if (request.method === "OPTIONS") {
      if (isAdminPath(path)) return new Response(null, { status: 204 });
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      return await route(request, env);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      // Anything unexpected is logged for us and reduced to a neutral message
      // for the caller — no stack traces, no SQL, no internals.
      if (status === 500) console.error("worker error", path, err);
      const body = {
        error: status === 500 ? "Something went wrong. Please try again." : err.message,
      };
      if (err.field) body.field = err.field;

      return isAdminPath(path)
        ? adminJson(body, status)
        : json(body, status, request, env);
    }
  },
};
