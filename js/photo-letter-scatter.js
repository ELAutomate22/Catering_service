/* =============================================================================
   PHOTO LETTER SCATTER — hover treatment for every real photo on the site
   -----------------------------------------------------------------------------
   On hover (fine pointers only) a photo's caption breaks into single characters
   that scatter in a loose cloud around it, while the photo zooms inside a frame
   that shrinks very slightly. Timing values come from the supplied reference.

   Two things about this site shaped the implementation:

   1. Every photo container clips (`overflow: hidden`) — cards, tiles, and the
      circular plate rotor. Rather than open those up and break the design, the
      letters live in one fixed overlay on <body> and are positioned from the
      photo's bounding rect. They can never be clipped, and no container CSS
      had to change.

   2. main.js writes `style.transform` on the hero plates, float cards and
      parallax figures on every scroll. Scaling those same elements here would
      fight it, so the shrinking "frame" is a wrapper inserted *inside* each
      figure. The figure's own transform is left to main.js.

   Photos are `figure.media`, which the site already uses for real photography
   and never for logos or icons. Opt a photo out with `data-no-letter-scatter`.
   ========================================================================== */
(function () {
  "use strict";

  var FINE_POINTER = "(hover: hover) and (pointer: fine)";
  var REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

  /* ---- timing + geometry, from the reference ---------------------------- */
  var IN_LETTER_DUR   = 0.22;
  var IN_LETTER_EASE  = "power2.in";
  var IN_STAGGER      = 0.009;
  var IN_DRIFT        = 40;    // extra px of travel on the letter's lead axis
  var OUT_LETTER_DUR  = 0.28;
  var OUT_LETTER_EASE = "power3.inOut";
  var OUT_STAGGER     = 0.006;
  var OUT_DRIFT       = 24;
  var ZOOM_DUR        = 0.9;
  var ZOOM_EASE       = "power4.out";
  var REST_DUR        = 0.62;
  var REST_EASE       = "power3.out";
  var IMAGE_SCALE     = 1.1;
  var FRAME_SCALE     = 0.96;
  var LETTER_SCALE    = [1.1, 2.05];
  var SPREAD_X        = { ratio: 0.78, min: 76,  max: 240 };
  var SPREAD_Y        = { ratio: 0.76, min: 100, max: 290 };

  var gsap = window.gsap;
  if (!gsap) return;

  var finePointer = window.matchMedia(FINE_POINTER);
  var reducedMotion = window.matchMedia(REDUCED_MOTION);

  function rand(min, max) { return min + Math.random() * (max - min); }

  /* Grapheme-aware so accented captions ("Canapé") don't split mid-character. */
  function splitGraphemes(text) {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      var seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return Array.from(seg.segment(text), function (s) { return s.segment; });
    }
    return Array.from(text);
  }

  /* ------------------------------------------------------------- overlay */
  var overlay = null, cloud = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "ls-overlay";
    overlay.setAttribute("aria-hidden", "true");
    cloud = document.createElement("div");
    cloud.className = "ls-cloud";
    overlay.appendChild(cloud);
    document.body.appendChild(overlay);
  }

  /* --------------------------------------------------------------- state */
  var current = null;      // figure whose letters are showing
  var letters = [];
  var letterTl = null;

  function anchorCloud(fig) {
    var r = fig.getBoundingClientRect();
    gsap.set(cloud, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  /* Keep the cloud pinned to its photo if the page moves under it. Browsers
     already coalesce scroll events to one per frame, so this needs no extra
     throttling — and not depending on rAF means it still works when the
     ticker is throttled. */
  function trackScroll() {
    if (current) anchorCloud(current);
  }

  /* --------------------------------------------------------------- letters */
  function buildLetters(fig) {
    var text = (fig.getAttribute("data-scatter-text") ||
                fig.getAttribute("data-label") ||
                (fig.querySelector("img") || {}).alt ||
                "").trim();
    if (!text) return false;

    var rect = fig.getBoundingClientRect();
    var spreadX = Math.min(SPREAD_X.max, Math.max(SPREAD_X.min, rect.width  * SPREAD_X.ratio));
    var spreadY = Math.min(SPREAD_Y.max, Math.max(SPREAD_Y.min, rect.height * SPREAD_Y.ratio));

    // Letters inherit the section's colour so they stay legible on the cream
    // sections and on the dark purple hero/Instagram bands alike.
    var tone = getComputedStyle(fig).getPropertyValue("--ls-color").trim();
    if (tone) cloud.style.setProperty("--ls-color", tone);
    var halo = getComputedStyle(fig).getPropertyValue("--ls-halo").trim();
    if (halo) cloud.style.setProperty("--ls-halo", halo);

    var frag = document.createDocumentFragment();
    letters = splitGraphemes(text)
      .filter(function (ch) { return !/^\s$/u.test(ch); })
      .map(function (ch, i) {
        var span = document.createElement("span");
        span.className = "ls-char";
        span.textContent = ch;
        // Alternating the dominant axis gives the loose, distributed cloud of
        // the reference rather than a tidy ring.
        var lead = i % 2 === 0;
        span._x = lead ? rand(-spreadX, spreadX) : rand(-spreadX * 0.72, spreadX * 0.72);
        span._y = lead ? rand(-spreadY * 0.72, spreadY * 0.72) : rand(-spreadY, spreadY);
        frag.appendChild(span);
        return span;
      });

    cloud.replaceChildren(frag);
    return letters.length > 0;
  }

  /* ------------------------------------------------------------------ show */
  function show(fig) {
    if (reducedMotion.matches) return;
    var parts = fig._ls;
    if (!parts) return;

    // Moving straight from one photo to another: let the old photo settle back
    // while the cloud is handed over to the new one.
    if (current && current !== fig) restPhoto(current);
    if (current === fig && letterTl && letterTl.isActive()) return;

    ensureOverlay();
    current = fig;
    if (letterTl) letterTl.kill();

    if (!buildLetters(fig)) { current = null; return; }
    anchorCloud(fig);
    overlay.classList.add("is-on");

    gsap.set(letters, {
      xPercent: -50, yPercent: -50,
      x: function (i, el) { return el._x; },
      y: function (i, el) { return el._y; },
      scale: function () { return rand(LETTER_SCALE[0], LETTER_SCALE[1]); },
      autoAlpha: 0
    });

    letterTl = gsap.timeline().to(letters, {
      duration: IN_LETTER_DUR,
      ease: IN_LETTER_EASE,
      x: function (i, el) { return el._x + (i % 2 === 0 ? rand(-IN_DRIFT, IN_DRIFT) : 0); },
      y: function (i, el) { return el._y + (i % 2 === 1 ? rand(-IN_DRIFT, IN_DRIFT) : 0); },
      autoAlpha: 1,
      stagger: { each: IN_STAGGER, from: "random" }
    });

    parts.zoom && parts.zoom.kill();
    parts.zoom = gsap.timeline()
      .to(parts.img,   { duration: ZOOM_DUR, ease: ZOOM_EASE, scale: IMAGE_SCALE }, 0)
      .to(parts.frame, { duration: ZOOM_DUR, ease: ZOOM_EASE, scale: FRAME_SCALE }, 0);
  }

  /* Return one photo's image + frame to rest, independent of the letters. */
  function restPhoto(fig) {
    var parts = fig._ls;
    if (!parts) return;
    parts.zoom && parts.zoom.kill();
    parts.zoom = gsap.timeline()
      .to(parts.img,   { duration: REST_DUR, ease: REST_EASE, scale: 1 }, 0)
      .to(parts.frame, { duration: REST_DUR, ease: REST_EASE, scale: 1 }, 0);
  }

  function hide(fig) {
    if (reducedMotion.matches) return;
    restPhoto(fig);
    if (current !== fig) return;

    current = null;
    if (letterTl) letterTl.kill();

    letterTl = gsap.timeline({
      onComplete: function () { if (!current) overlay.classList.remove("is-on"); }
    }).to(letters, {
      duration: OUT_LETTER_DUR,
      ease: OUT_LETTER_EASE,
      x: function (i) { return i % 2 === 0 ? "+=" + rand(-OUT_DRIFT, OUT_DRIFT) : "+=0"; },
      y: function (i) { return i % 2 === 1 ? "+=" + rand(-OUT_DRIFT, OUT_DRIFT) : "+=0"; },
      autoAlpha: 0,
      stagger: { each: OUT_STAGGER, from: "random" }
    });
  }

  /* ------------------------------------------------------------------ init */
  var bound = [];

  function enhance(fig) {
    if (fig._ls) return;
    var img = fig.querySelector("img");
    if (!img) return;

    // The frame is what shrinks. It has to be a wrapper inside the figure so
    // the figure's own transform stays available to main.js's parallax.
    var frame = document.createElement("span");
    frame.className = "ls-frame";
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    fig.classList.add("ls-photo");

    fig._ls = { img: img, frame: frame, zoom: null };
  }

  function bindHover(fig) {
    function onEnter() { if (finePointer.matches) show(fig); }
    function onLeave() { if (!fig.contains(document.activeElement)) hide(fig); }
    function onFocusIn() { show(fig); }
    function onFocusOut(e) {
      if (!fig.contains(e.relatedTarget) && !(finePointer.matches && fig.matches(":hover"))) hide(fig);
    }
    fig.addEventListener("pointerenter", onEnter);
    fig.addEventListener("pointerleave", onLeave);
    fig.addEventListener("focusin", onFocusIn);
    fig.addEventListener("focusout", onFocusOut);
    bound.push(function () {
      fig.removeEventListener("pointerenter", onEnter);
      fig.removeEventListener("pointerleave", onLeave);
      fig.removeEventListener("focusin", onFocusIn);
      fig.removeEventListener("focusout", onFocusOut);
    });
  }

  function photos(scope) {
    return Array.prototype.filter.call(
      (scope || document).querySelectorAll("figure.media"),
      function (fig) {
        return fig.id !== "lightboxFigure" &&
               !fig.hasAttribute("data-no-letter-scatter");
      }
    );
  }

  function init(scope) {
    var list = photos(scope);
    list.forEach(enhance);

    // On touch and with reduced motion the site keeps exactly its existing
    // behaviour: no letters, no inline transforms, CSS hover zoom untouched.
    if (reducedMotion.matches || !finePointer.matches) return list.length;

    list.forEach(function (fig) {
      // An inline transform means the CSS :hover zoom rules stop applying, so
      // GSAP is the only thing moving the image. Avoids a double animation.
      fig.classList.add("ls-live");
      gsap.set(fig._ls.img, { scale: 1 });
      gsap.set(fig._ls.frame, { scale: 1 });
      bindHover(fig);
    });

    window.addEventListener("scroll", trackScroll, { passive: true });
    window.addEventListener("resize", trackScroll, { passive: true });
    bound.push(function () {
      window.removeEventListener("scroll", trackScroll);
      window.removeEventListener("resize", trackScroll);
    });

    return list.length;
  }

  function destroy() {
    bound.forEach(function (off) { off(); });
    bound = [];
    if (letterTl) letterTl.kill();
    letterTl = null;
    current = null;
    photos(document).forEach(function (fig) {
      if (!fig._ls) return;
      fig._ls.zoom && fig._ls.zoom.kill();
      fig.classList.remove("ls-live");
      gsap.set([fig._ls.img, fig._ls.frame], { clearProps: "transform" });
    });
    if (overlay) overlay.classList.remove("is-on");
  }

  // If someone turns reduced motion on mid-visit, stand everything down.
  reducedMotion.addEventListener("change", function () {
    if (reducedMotion.matches) destroy();
  });

  window.PhotoLetterScatter = { init: init, destroy: destroy };

  // main.js renders the menu, events and gallery photos inside its own
  // DOMContentLoaded handler, which is registered first and so runs first.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(document); });
  } else {
    init(document);
  }
})();
