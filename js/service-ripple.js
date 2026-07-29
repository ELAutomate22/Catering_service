/* =============================================================================
   SERVICE CARD RIPPLE — a droplet landing in water, spreading across the grid
   -----------------------------------------------------------------------------
   Hovering any of the 8 service cards drops a "droplet" exactly where the
   pointer entered. Concentric rings then expand outward across the WHOLE grid,
   so neighbouring cards show the wave arriving a moment later.

   How the clipping works: every card owns its own small canvas. A ripple is
   stored in grid coordinates, and each card draws it offset by its own
   position. Anything falling outside a card simply isn't drawn by that card —
   so the wave never appears in the gaps between cards or beyond the grid.

   The canvas sits *under* the card's icon and text (z-index), and ring alpha is
   deliberately low, so wording stays perfectly readable while the wave moves.
   ========================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    rgb: [60, 37, 104],  // #3C2568 — the hero/home-page purple
    duration: 2200,      // ms for a wave to cross the grid
    maxAlpha: 0.55,      // peak fill opacity of a wave band
    rings: 6,            // number of waves in the band
    ringGap: 88,         // px between wave crests
    splashAlpha: 0.45,   // the initial droplet impact blob
    maxRipples: 4        // concurrent waves
  };

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cards = [], grid = null, ripples = [], running = false, dpr = 1;

  // gentler than cubic: the wave keeps travelling instead of stalling early
  function easeOut(p) { return 1 - Math.pow(1 - p, 2); }

  /* Size each card's canvas to its box (accounting for retina screens). */
  function measure() {
    if (!grid) return;
    var g = grid.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], r = c.el.getBoundingClientRect();
      c.x = r.left - g.left;      // card position within the grid
      c.y = r.top - g.top;
      c.w = r.width;
      c.h = r.height;
      if (c.canvas.width !== Math.round(r.width * dpr) ||
          c.canvas.height !== Math.round(r.height * dpr)) {
        c.canvas.width = Math.round(r.width * dpr);
        c.canvas.height = Math.round(r.height * dpr);
      }
    }
    // furthest a wave must travel to reach every corner of the grid
    maxRadius = Math.sqrt(g.width * g.width + g.height * g.height);
  }
  var maxRadius = 1200;

  function spawn(gx, gy) {
    if (reduced) return;
    if (ripples.length >= CONFIG.maxRipples) ripples.shift();
    ripples.push({ x: gx, y: gy, born: performance.now() });
    start();
  }

  function draw(now) {
    var alive = [];
    for (var r = 0; r < ripples.length; r++) {
      if ((now - ripples[r].born) / CONFIG.duration < 1) alive.push(ripples[r]);
    }
    ripples = alive;

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], ctx = c.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.w, c.h);
      if (!ripples.length) continue;

      for (var j = 0; j < ripples.length; j++) {
        var rp = ripples[j];
        var p = (now - rp.born) / CONFIG.duration;
        var R = maxRadius * easeOut(p);
        var fade = Math.pow(1 - p, 1.4);
        // origin translated into this card's own coordinate space
        var ox = rp.x - c.x, oy = rp.y - c.y;

        // The wave band is painted as SOLID PURPLE water rather than outlines.
        // A single radial gradient carries every crest: each wave peaks at full
        // colour and fades away between crests, so the ripples read as bands of
        // colour spreading outward instead of thin lines.
        var band = CONFIG.rings * CONFIG.ringGap;
        var inner = Math.max(0, R - band);
        var span = R - inner;
        if (R > 1 && span > 1) {
          var gs = ctx.createRadialGradient(ox, oy, inner, ox, oy, R);
          var stops = [[0, 0], [1, 0]];               // fade out at both edges
          for (var k = 0; k < CONFIG.rings; k++) {
            var rad = R - k * CONFIG.ringGap;         // this crest's radius
            if (rad <= inner) continue;
            var t = (rad - inner) / span;             // its place in the gradient
            var a = CONFIG.maxAlpha * fade * (1 - k / (CONFIG.rings + 0.5));
            if (a <= 0.004) continue;
            var halfW = (CONFIG.ringGap * 0.5) / span;
            stops.push([t - halfW, 0]);               // trough before the crest
            stops.push([t, a]);                       // full-colour crest
            stops.push([t + halfW, 0]);               // trough after it
          }
          stops.sort(function (m, n) { return m[0] - n[0]; });
          var last = -1;
          for (var s = 0; s < stops.length; s++) {
            var off = Math.min(1, Math.max(0, stops[s][0]));
            if (off <= last) off = Math.min(1, last + 0.0001); // must ascend
            last = off;
            gs.addColorStop(off, "rgba(" + CONFIG.rgb + "," + stops[s][1].toFixed(4) + ")");
          }
          ctx.fillStyle = gs;
          ctx.beginPath();
          ctx.arc(ox, oy, R, 0, Math.PI * 2);
          ctx.fill();
        }

        // quick droplet impact splash, only at the very start
        if (p < 0.3) {
          var sp = p / 0.3;
          var sr = 6 + sp * 46;
          var g2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, sr);
          var sa = CONFIG.splashAlpha * (1 - sp);
          g2.addColorStop(0, "rgba(" + CONFIG.rgb + "," + sa + ")");
          g2.addColorStop(1, "rgba(" + CONFIG.rgb + ",0)");
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(ox, oy, sr, 0, Math.PI * 2);
          ctx.fill();
        }

      }
    }
  }

  function frame(now) {
    draw(now);
    if (ripples.length && !document.hidden) requestAnimationFrame(frame);
    else { running = false; draw(performance.now() + CONFIG.duration); } // final clear
  }

  function start() {
    if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); }
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    grid = document.getElementById("servicesGrid");
    if (!grid) return;
    var els = grid.querySelectorAll(".service-card");
    if (!els.length) { setTimeout(init, 120); return; }  // cards render from JS

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var cv = document.createElement("canvas");
      cv.className = "service-ripple";
      cv.setAttribute("aria-hidden", "true");
      el.insertBefore(cv, el.firstChild);
      cards.push({ el: el, canvas: cv, ctx: cv.getContext("2d"), x: 0, y: 0, w: 0, h: 0 });
    }
    measure();

    var gridRect = null;
    grid.addEventListener("pointerenter", function () { gridRect = grid.getBoundingClientRect(); }, true);

    // a droplet lands where the pointer enters a card
    for (var j = 0; j < cards.length; j++) {
      (function (card) {
        card.el.addEventListener("pointerenter", function (e) {
          if (e.pointerType && e.pointerType !== "mouse") return;
          var g = grid.getBoundingClientRect();
          spawn(e.clientX - g.left, e.clientY - g.top);
        });
      })(cards[j]);
    }

    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", function () { /* rects are grid-relative */ }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && ripples.length) start();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
