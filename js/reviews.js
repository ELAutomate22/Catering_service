/* =============================================================================
   REVIEWS — public star reviews backed by Supabase
   -----------------------------------------------------------------------------
   • Loads reviews from the database so every visitor sees the same list.
   • "Leave a Review" opens a modal: star rating + name + occasion + details.
   • Posting saves to the database and the review appears immediately.
   • The average rating (out of 5) is shown at the top of the section and is
     recalculated from every review, including owner-curated ones in
     config.js → testimonials.

   Talks to Supabase's REST API with plain fetch — no external library, so the
   site stays dependency-free. Connection details live in config.js →
   reviewsApi.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = CFG.reviewsApi || {};
  var ENDPOINT = API.url ? API.url + "/rest/v1/" + API.table : null;

  function $(s, c) { return (c || document).querySelector(s); }

  /* Reviews are visitor-supplied text — always escape before inserting. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linejoin="round" d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2 6.6 20.1l1-6.1L3.2 9.7l6.1-.9z"/></svg>';

  /* A 0–5 value rendered as five stars, the gold layer clipped to a % width
     so half/partial ratings (e.g. 4.3) display accurately. */
  function starRow(value) {
    var pct = Math.max(0, Math.min(5, Number(value) || 0)) / 5 * 100;
    var row = "";
    for (var i = 0; i < 5; i++) row += STAR_SVG;
    return '<span class="star-row" style="--pct:' + pct.toFixed(2) + '%">' +
             '<span class="star-row-base">' + row + "</span>" +
             '<span class="star-row-fill">' + row + "</span>" +
           "</span>";
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  }

  /* ---------------------------------------------------------------- state */
  var seeded = (CFG.testimonials || []).map(function (t) {
    return { name: t.name, role: t.role, quote: t.quote, rating: t.rating, created_at: null, seed: true };
  });
  var reviews = seeded.slice();

  /* ------------------------------------------------------------- rendering */
  function renderList() {
    var grid = $("#testimonialsGrid");
    var empty = $("#reviewsEmpty");
    if (!grid) return;
    grid.innerHTML = "";

    if (!reviews.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    reviews.forEach(function (r) {
      var initial = (r.name || "•").trim().charAt(0).toUpperCase();
      var fig = document.createElement("figure");
      fig.className = "testimonial reveal in";
      fig.innerHTML =
        (r.rating ? starRow(r.rating) : "") +
        '<blockquote class="testimonial-quote">' + esc(r.quote) + "</blockquote>" +
        '<figcaption class="testimonial-author">' +
          '<span class="testimonial-avatar">' + esc(initial) + "</span>" +
          "<span><span class='testimonial-name'>" + esc(r.name) + "</span>" +
          (r.role ? "<br><span class='testimonial-role'>" + esc(r.role) + "</span>" : "") +
          "</span>" +
          (r.created_at ? '<span class="testimonial-date">' + esc(fmtDate(r.created_at)) + "</span>" : "") +
        "</figcaption>";
      grid.appendChild(fig);
    });
  }

  function renderAverage() {
    var avgEl = $("#ratingAverage"), starsEl = $("#ratingStars"), countEl = $("#ratingCount");
    if (!avgEl || !starsEl || !countEl) return;

    var rated = reviews.filter(function (r) { return Number(r.rating) > 0; });
    if (!rated.length) {
      avgEl.textContent = "—";
      starsEl.innerHTML = starRow(0);
      countEl.textContent = "No reviews yet";
      return;
    }
    var sum = rated.reduce(function (a, r) { return a + Number(r.rating); }, 0);
    var avg = sum / rated.length;
    // 5,5,5 → "5"; 4.5 → "4.5" (no trailing .0)
    avgEl.textContent = (Math.round(avg * 10) / 10).toString();
    starsEl.innerHTML = starRow(avg);
    countEl.textContent = "out of 5 · " + rated.length + (rated.length === 1 ? " review" : " reviews");
  }

  function renderAll() { renderAverage(); renderList(); }

  /* ---------------------------------------------------------------- loading */
  function loadReviews() {
    if (!ENDPOINT) { renderAll(); return; }
    fetch(ENDPOINT + "?select=name,role,rating,quote,created_at&order=created_at.desc&limit=100", {
      headers: { apikey: API.key, Authorization: "Bearer " + API.key }
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (rows) {
        reviews = (rows || []).concat(seeded);
        renderAll();
      })
      .catch(function () { renderAll(); }); // offline: still show curated ones
  }

  /* ------------------------------------------------------------------ modal */
  var rating = 0, lastFocus = null;

  function buildStars() {
    var row = $(".star-input-row", $("#starInput"));
    var label = $("#starInputLabel");
    if (!row) return;
    var words = ["Poor", "Fair", "Good", "Very good", "Excellent"];

    function paint(v) {
      Array.prototype.forEach.call(row.children, function (b, i) {
        b.classList.toggle("on", i < v);
        b.setAttribute("aria-checked", String(i + 1 === rating));
      });
      label.textContent = v ? words[v - 1] : "Select a rating";
    }

    for (var i = 1; i <= 5; i++) {
      (function (v) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "star-btn";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.setAttribute("aria-label", v + (v === 1 ? " star" : " stars"));
        b.innerHTML = STAR_SVG;
        b.addEventListener("click", function () { rating = v; paint(v); });
        b.addEventListener("mouseenter", function () { paint(v); });
        b.addEventListener("focus", function () { paint(v); });
        row.appendChild(b);
      })(i);
    }
    row.addEventListener("mouseleave", function () { paint(rating); });
    row.addEventListener("blur", function () { paint(rating); }, true);
    paint(0);
  }

  function openModal() {
    var m = $("#reviewModal"); if (!m) return;
    lastFocus = document.activeElement;
    m.hidden = false;
    requestAnimationFrame(function () { m.classList.add("open"); });
    document.body.style.overflow = "hidden";
    var first = $("#starInput .star-btn"); if (first) first.focus();
  }

  function closeModal() {
    var m = $("#reviewModal"); if (!m) return;
    m.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(function () { m.hidden = true; }, 300);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showError(msg) {
    var e = $("#reviewError");
    if (!e) return;
    e.textContent = msg;
    e.hidden = !msg;
  }

  function submit(ev) {
    ev.preventDefault();
    var name = $("#reviewName").value.trim();
    var role = $("#reviewRole").value.trim();
    var quote = $("#reviewText").value.trim();
    var btn = $("#reviewSubmit");

    if (!rating) return showError("Please choose a star rating.");
    if (name.length < 2) return showError("Please enter your name.");
    if (quote.length < 10) return showError("Please tell us a little more (at least 10 characters).");
    showError("");

    var row = { name: name, role: role || null, rating: rating, quote: quote };

    if (!ENDPOINT) { // no database configured — show locally so nothing is lost
      reviews.unshift(row); renderAll(); closeModal(); return;
    }

    btn.disabled = true;
    btn.textContent = "Posting…";
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        apikey: API.key,
        Authorization: "Bearer " + API.key,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(row)
    })
      .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); })
      .then(function (saved) {
        reviews.unshift((saved && saved[0]) || row);
        renderAll();
        closeModal();
        // reset for next time
        $("#reviewForm").reset();
        rating = 0;
        var lbl = $("#starInputLabel"); if (lbl) lbl.textContent = "Select a rating";
        Array.prototype.forEach.call($(".star-input-row").children, function (b) {
          b.classList.remove("on"); b.setAttribute("aria-checked", "false");
        });
        $("#reviewCount").textContent = "0";
      })
      .catch(function () {
        showError("Sorry — your review couldn’t be posted just now. Please try again.");
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = "Post Review";
      });
  }

  /* -------------------------------------------------------------------- init */
  function init() {
    var openBtn = $("#openReviewBtn");
    var modal = $("#reviewModal");
    if (!openBtn || !modal) return;

    buildStars();
    openBtn.addEventListener("click", openModal);
    $("#reviewClose").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) closeModal();
    });
    $("#reviewForm").addEventListener("submit", submit);
    $("#reviewText").addEventListener("input", function () {
      $("#reviewCount").textContent = this.value.length;
    });

    loadReviews();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
