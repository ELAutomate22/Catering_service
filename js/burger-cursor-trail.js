/* =============================================================================
   BurgerCursorTrail — subtle branded cursor trail (hand-drawn burger outlines)
   -----------------------------------------------------------------------------
   One fixed, pointer-events:none canvas covers the viewport. As the mouse
   moves over "plain" content, small line-art burgers spawn along the pointer
   path and fade out. The effect NEVER renders over the header/nav, any image
   or media, image containers, or anything marked .no-cursor-trail /
   [data-no-cursor-trail].

   Exclusion strategy (combined approach C):
     1. SPAWN-TIME:  document.elementFromPoint + closest(EXCLUDE_SELECTOR)
                     + cached "has CSS background-image: url(...)" walk-up.
     2. RENDER-TIME: each particle's visible bounds are tested against a
                     cached list of exclusion rectangles (header, images,
                     media containers...). Overlapping particles are skipped,
                     so nothing drifts into a clean zone.
   Rect cache refreshes on scroll/resize (rAF-throttled), on image load,
   and on DOM changes (MutationObserver) / element size changes
   (ResizeObserver) — never on every animation frame.

   Plain-JS module: include once, auto-initialises. window.BurgerCursorTrail
   exposes { init, destroy } for manual control.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------ CONFIG --------------------------------- */
  var CONFIG = {
    color: "#2E1A47",        // burger line colour (brand royal purple)
    haloColor: "rgba(255,255,255,.85)", // halo under the lines for visibility
    sizeMin: 16,             // px — smallest burger (~0.5cm nominal: 19px ±15%)
    sizeMax: 22,             // px — largest burger
    lifeMin: 900,            // ms — shortest particle life
    lifeMax: 1300,           // ms — longest particle life
    spawnDistance: 24,       // px of pointer travel between spawns
    scatterRadius: 40,       // px — ~1cm jitter radius around the cursor path
    maxOpacity: 0.42,        // peak particle opacity
    rotationRange: 28,       // deg — random rotation is ±this
    scaleWobble: 0.05,       // extra random scale variation (kept subtle — most burgers ≈19px)
    maxParticles: 90,        // hard cap on live particles
    zIndex: 90,              // above content, below the header (header is 100)
    // Anything matching this (or inside it) never gets the effect.
    // Site-specific containers are listed after the generic tags.
    // NB: ".site-header" (not bare "header") — the page also uses semantic
    // <header class="section-head"> for section titles, which must stay eligible.
    excludeSelector: [
      ".site-header", "nav", "img", "picture", "video", "iframe",
      "canvas:not(.burger-trail-canvas)", "svg",
      ".no-cursor-trail", "[data-no-cursor-trail]",
      ".media", ".gallery-item", ".insta-tile", ".hero-plate",
      ".float-card", ".lightbox", ".nav-backdrop"
    ].join(",")
  };

  /* ----------------------- capability / motion gates --------------------- */
  var finePointer = window.matchMedia("(pointer: fine)").matches &&
                    window.matchMedia("(hover: hover)").matches;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var state = null; // holds everything so destroy() can clean up

  /* ------------------------- burger sprite ------------------------------- */
  // Hand-drawn burger outline (wobbly strokes for a sketched feel), drawn in
  // a 64x64 box. To use a different drawing, replace the strokes in
  // drawBurgerPath() — everything else adapts automatically.
  function drawBurgerPath(ctx) {
    // top bun dome (slightly asymmetric = hand-drawn)
    ctx.beginPath();
    ctx.moveTo(9, 30);
    ctx.bezierCurveTo(7, 15, 22, 7, 32, 8);
    ctx.bezierCurveTo(43, 7, 57, 16, 55, 30);
    ctx.bezierCurveTo(48, 31.5, 16, 31.5, 9, 30);
    ctx.stroke();
    // sesame seeds (short ticks)
    [[20, 18, 24, 16.5], [30, 13.5, 34, 13], [40, 17, 44, 18.5]].forEach(function (s) {
      ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke();
    });
    // lettuce wave
    ctx.beginPath();
    ctx.moveTo(8, 37);
    ctx.quadraticCurveTo(12, 43, 16, 37.5);
    ctx.quadraticCurveTo(20, 43.5, 24, 37);
    ctx.quadraticCurveTo(28, 43, 32, 37.5);
    ctx.quadraticCurveTo(36, 43.5, 40, 37);
    ctx.quadraticCurveTo(44, 43, 48, 37.5);
    ctx.quadraticCurveTo(52, 43, 56, 37);
    ctx.stroke();
    // patty
    ctx.beginPath();
    ctx.moveTo(10, 47);
    ctx.quadraticCurveTo(32, 45.5, 54, 47);
    ctx.stroke();
    // bottom bun
    ctx.beginPath();
    ctx.moveTo(10, 51);
    ctx.lineTo(54, 51);
    ctx.quadraticCurveTo(55, 57.5, 48, 58);
    ctx.lineTo(16, 58);
    ctx.quadraticCurveTo(9, 57.5, 10, 51);
    ctx.stroke();
  }

  // Pre-render the sprite once (halo pass + line pass) at max size * DPR.
  function makeSprite(dpr) {
    var pad = 6; // room for the halo blur
    var box = 64 + pad * 2;
    var scale = (CONFIG.sizeMax / 64) * dpr;
    var c = document.createElement("canvas");
    c.width = c.height = Math.ceil(box * scale);
    var ctx = c.getContext("2d");
    ctx.scale(scale, scale);
    ctx.translate(pad, pad);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // halo pass (thick, soft white under-stroke)
    ctx.strokeStyle = CONFIG.haloColor;
    ctx.lineWidth = 6;
    drawBurgerPath(ctx);
    // ink pass (slightly bolder in sprite units so ~19px burgers stay legible
    // without looking thick — at 19px this renders ≈0.9px lines)
    ctx.strokeStyle = CONFIG.color;
    ctx.lineWidth = 3;
    drawBurgerPath(ctx);
    return c;
  }

  /* ----------------------- exclusion bookkeeping ------------------------- */
  var bgImageCache = new WeakMap(); // element -> boolean "has url() background"

  function hasBgImage(el) {
    if (bgImageCache.has(el)) return bgImageCache.get(el);
    var v = false;
    try { v = getComputedStyle(el).backgroundImage.indexOf("url(") > -1; } catch (e) {}
    bgImageCache.set(el, v);
    return v;
  }

  // Spawn-time check: is the viewport point (x,y) over excluded content?
  function isExcludedAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return true;
    if (el.closest(CONFIG.excludeSelector)) return true;
    // walk a few ancestors looking for CSS background images
    var node = el, hops = 0;
    while (node && node.nodeType === 1 && hops < 5) {
      if (hasBgImage(node)) return true;
      node = node.parentElement; hops++;
    }
    return false;
  }

  // Render-time rect cache. Tracked elements are queried only when the DOM
  // mutates; their rects are re-read (cheap) on scroll/resize/mutation.
  function collectTrackedElements() {
    var sel = ".site-header, img, picture, video, iframe, .no-cursor-trail," +
              "[data-no-cursor-trail], .media, .gallery-item, .insta-tile," +
              ".hero-plate, .float-card";
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  function refreshRects(st) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var rects = [];
    for (var i = 0; i < st.tracked.length; i++) {
      var r = st.tracked[i].getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;            // hidden
      if (r.bottom < -60 || r.top > vh + 60) continue;      // far off-screen
      if (r.right < -60 || r.left > vw + 60) continue;
      rects.push(r);
    }
    st.rects = rects;
    st.rectsDirty = false;
  }

  function overlapsExcluded(st, x, y, half) {
    var rs = st.rects;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (x + half > r.left && x - half < r.right &&
          y + half > r.top && y - half < r.bottom) return true;
    }
    return false;
  }

  /* ------------------------------- init ---------------------------------- */
  function init(force) {
    // touch devices / reduced-motion users: no effect (pass true to override for testing)
    if (state || (!force && (!finePointer || reducedMotion))) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var canvas = document.createElement("canvas");
    canvas.className = "burger-trail-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;" +
      "z-index:" + CONFIG.zIndex + ";";
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var st = state = {
      canvas: canvas, ctx: ctx, dpr: dpr,
      sprite: makeSprite(dpr),
      particles: [],
      lastX: null, lastY: null,   // last spawn anchor (null = trail reset)
      running: false, rafId: 0,
      tracked: collectTrackedElements(),
      rects: [], rectsDirty: true,
      cleanups: []
    };

    function sizeCanvas() {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      st.rectsDirty = true;
    }
    sizeCanvas();

    /* ------- spawning ------- */
    function spawnAt(x, y) {
      if (st.particles.length >= CONFIG.maxParticles) st.particles.shift();
      var size = CONFIG.sizeMin + Math.random() * (CONFIG.sizeMax - CONFIG.sizeMin);
      // subtle positional scatter within ~1cm of the path point
      var a = Math.random() * Math.PI * 2;
      var d = Math.random() * CONFIG.scatterRadius * 0.55;
      st.particles.push({
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        size: size * (1 + (Math.random() * 2 - 1) * CONFIG.scaleWobble),
        rot: (Math.random() * 2 - 1) * CONFIG.rotationRange * Math.PI / 180,
        born: performance.now(),
        life: CONFIG.lifeMin + Math.random() * (CONFIG.lifeMax - CONFIG.lifeMin)
      });
    }

    function onPointerMove(e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var x = e.clientX, y = e.clientY;

      if (isExcludedAt(x, y)) {   // over header/image/etc: cut the trail
        st.lastX = st.lastY = null;
        return;
      }
      if (st.lastX === null) {    // fresh trail start — no line across zones
        st.lastX = x; st.lastY = y;
        spawnAt(x, y);
        startLoop();
        return;
      }
      // interpolate along the travelled segment so fast moves leave no gaps
      var dx = x - st.lastX, dy = y - st.lastY;
      var dist = Math.hypot(dx, dy);
      if (dist < CONFIG.spawnDistance) return;
      var steps = Math.floor(dist / CONFIG.spawnDistance);
      for (var i = 1; i <= steps; i++) {
        var px = st.lastX + (dx * i) / steps;
        var py = st.lastY + (dy * i) / steps;
        if (isExcludedAt(px, py)) { st.lastX = st.lastY = null; return; }
        spawnAt(px, py);
      }
      st.lastX = x; st.lastY = y;
      startLoop();
    }

    function onPointerLeave() { st.lastX = st.lastY = null; }

    /* ------- render loop (runs only while particles exist) ------- */
    function frame(now) {
      st.rafId = 0;
      if (st.rectsDirty) refreshRects(st);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var live = [];
      var sprite = st.sprite;
      var spriteBox = 64 + 12; // drawing box incl. halo padding
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        var t = (now - p.born) / p.life;
        if (t >= 1) continue;
        live.push(p);
        // skip (but keep) particles whose visible bounds touch a clean zone
        var half = (p.size * 1.42) / 2 + 4; // rotation-safe half-diagonal
        if (overlapsExcluded(st, p.x, p.y, half)) continue;
        // ease-out fade with a quick fade-in at birth
        var fadeIn = Math.min(t / 0.12, 1);
        var alpha = CONFIG.maxOpacity * fadeIn * (1 - t) * (1 - t * 0.2);
        var scale = (p.size / 64) * (1 + t * 0.06) * dpr; // gentle drift-grow
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        var w = spriteBox * scale;
        ctx.drawImage(sprite, -w / 2, -w / 2, w, w);
        ctx.restore();
      }
      st.particles = live;
      if (live.length && st.running) st.rafId = requestAnimationFrame(frame);
      else { st.running = false; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }

    function startLoop() {
      if (!st.running && !document.hidden) {
        st.running = true;
        st.rafId = requestAnimationFrame(frame);
      }
    }

    /* ------- cache invalidation (never per-frame DOM scans) ------- */
    var markDirty = function () { st.rectsDirty = true; };
    var retrack = (function () {
      var pending = false;
      return function () {          // DOM changed: re-query tracked elements
        if (pending) return;
        pending = true;
        setTimeout(function () {
          pending = false;
          st.tracked = collectTrackedElements();
          st.rectsDirty = true;
        }, 120);
      };
    })();

    window.addEventListener("scroll", markDirty, { passive: true });
    window.addEventListener("resize", function () { sizeCanvas(); }, { passive: true });
    document.addEventListener("load", markDirty, true); // images finishing loading
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave); // pointer exits window
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {        // pause when tab hidden
        st.running = false;
        if (st.rafId) cancelAnimationFrame(st.rafId);
        st.rafId = 0;
      } else if (st.particles.length) startLoop();
    });

    var mo = new MutationObserver(retrack);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "class", "style"] });
    var ro = new ResizeObserver(markDirty);
    ro.observe(document.documentElement);

    st.cleanups.push(function () {
      mo.disconnect(); ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      window.removeEventListener("scroll", markDirty);
      document.removeEventListener("load", markDirty, true);
      if (st.rafId) cancelAnimationFrame(st.rafId);
      canvas.remove();
    });
  }

  function destroy() {
    if (!state) return;
    state.cleanups.forEach(function (fn) { fn(); });
    state = null;
  }

  window.BurgerCursorTrail = { init: init, destroy: destroy, config: CONFIG };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
