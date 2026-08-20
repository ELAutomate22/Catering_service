/* =============================================================================
   SAVORÉ — MAIN SCRIPT
   - Binds config.js values into the page (brand, phone, Instagram)
   - Renders repeated sections (services, menus, events, gallery, testimonials)
   - Drives the cinematic 3D scroll experience (hero depth + feature scrub)
   - Handles reveals, nav, gallery lightbox
   No external libraries — works by simply opening index.html.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var IMG = "assets/images/";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- tiny helpers -------------------------------------------------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* Elegant fallback for missing photos: mark the .media so its designed
     gradient + label show instead of a broken image icon. */
  function wireImageFallback(img) {
    var media = img.closest(".media");
    if (!media) return;
    function fail() { media.classList.add("is-missing"); }
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener("error", fail);
    img.addEventListener("load", function () {
      if (img.naturalWidth === 0) fail();
      else media.classList.remove("is-missing");
    });
  }

  /* =========================================================================
     1. BIND CONFIG → PAGE
     ====================================================================== */
  function bindConfig() {
    // text bindings
    $all("[data-text]").forEach(function (node) {
      var val = get(CFG, node.getAttribute("data-text"));
      if (val != null) node.textContent = val;
    });
    // phone (tel:) links
    var tel = get(CFG, "contact.phoneHref") || "";
    $all("[data-href-tel]").forEach(function (node) {
      node.setAttribute("href", "tel:" + tel.replace(/\s+/g, ""));
    });
    // Instagram links — open in a new tab, safely
    var ig = get(CFG, "contact.instagramUrl") || "#";
    $all("[data-href-ig]").forEach(function (node) {
      node.setAttribute("href", ig);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    });
    // Cakes cross-link (sister site). No URL configured -> the block stays
    // hidden, so the section simply reads as it did before.
    var cakesUrl = get(CFG, "cakes.url") || "";
    var cakesBlock = $("#cakesCta");
    if (cakesBlock) {
      if (cakesUrl) {
        $all("[data-href-cakes]").forEach(function (node) {
          node.setAttribute("href", cakesUrl);
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        });
        cakesBlock.hidden = false;
      }
    }

    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
    document.title = (get(CFG, "brand.name") || "SAVORÉ") + " — " + (get(CFG, "brand.tagline") || "Fine Catering");
  }

  /* =========================================================================
     1b. PHONE LINKS — dial on phones, do nothing on desktops
     -------------------------------------------------------------------------
     On a phone or tablet a tel: link hands the number straight to the dialler,
     ready to call. A desktop can't place a call, so there the click is
     neutralised (no Skype/FaceTime prompt, no dead-end navigation) while the
     number stays on screen to read or copy.

     The check errs on the side of allowing calls: it only blocks when the
     device is clearly a desktop, so an unusual mobile browser never loses the
     ability to dial.
     ====================================================================== */
  function isDesktopDevice() {
    var ua = navigator.userAgent || "";
    var mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Windows Phone|Opera Mini|IEMobile|Mobile|Tablet|Silk|Kindle|PlayBook/i.test(ua);
    // iPadOS 13+ reports a desktop Mac UA, so detect it by touch capability
    var iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    return !mobileUA && !iPadOS;
  }

  function initPhoneLinks() {
    if (!isDesktopDevice()) return;         // phones/tablets: leave tel: alone
    document.documentElement.classList.add("no-dialler");
    // delegated in the capture phase so it also covers phone links that are
    // rendered later (contact cards, footer)
    document.addEventListener("click", function (e) {
      var t = e.target;
      var a = t && t.closest ? t.closest('a[href^="tel:"]') : null;
      if (a) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  /* =========================================================================
     2. RENDER SECTIONS
     ====================================================================== */
  // small inline SVG icon set for the service cards
  var ICONS = {
    rings:   '<svg viewBox="0 0 24 24"><circle cx="9" cy="14" r="6"/><circle cx="16" cy="14" r="6"/><path d="M12 4l2 3h-4z"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    briefcase:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    cake:    '<svg viewBox="0 0 24 24"><path d="M4 20h16v-6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3zM12 4v3M8 6v1M16 6v1M4 16h16"/></svg>',
    buffet:  '<svg viewBox="0 0 24 24"><path d="M3 11a9 9 0 0 1 18 0zM2 15h20M6 15v4M18 15v4"/></svg>',
    platter: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="13" rx="9" ry="4"/><path d="M12 9V6M9 6h6"/></svg>',
    canape:  '<svg viewBox="0 0 24 24"><path d="M12 3v4.5"/><circle cx="12" cy="10" r="2.2"/><rect x="7" y="13.4" width="10" height="4.2" rx="1"/><path d="M5 20h14"/></svg>',
    menu:    '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>'
  };

  function figure(name, label) {
    return '<figure class="media" data-label="' + label + '"><img src="' + IMG + name + '" alt="' + label + '" loading="lazy" /></figure>';
  }

  function renderServices() {
    var grid = $("#servicesGrid"); if (!grid || !CFG.services) return;
    CFG.services.forEach(function (s, i) {
      var card = el("article", "service-card reveal",
        '<div class="service-ico">' + (ICONS[s.icon] || ICONS.menu) + '</div>' +
        '<h3>' + s.title + '</h3><p>' + s.desc + '</p>');
      card.style.transitionDelay = (i % 4) * 0.06 + "s";
      grid.appendChild(card);
    });
  }

  function renderMenu() {
    var grid = $("#menuGrid"); if (!grid || !CFG.menu) return;
    CFG.menu.forEach(function (m, i) {
      var tags = (m.items || []).map(function (t) { return "<span>" + t + "</span>"; }).join("");
      // a category may supply one "image" or an "images" array (stacked halves,
      // each zooming independently on hover)
      var visual;
      if (m.images && m.images.length) {
        visual = '<div class="menu-split">' + m.images.map(function (src, n) {
          return '<div class="menu-split-item">' + figure(src, m.title + " " + (n + 1)) + "</div>";
        }).join("") + "</div>";
      } else {
        visual = figure(m.image, m.title);
      }
      var card = el("article", "menu-card reveal",
        visual +
        '<div class="menu-card-body"><h3>' + m.title + '</h3><p>' + m.desc + '</p>' +
        '<div class="menu-tags">' + tags + '</div></div>');
      card.style.transitionDelay = (i % 3) * 0.07 + "s";
      grid.appendChild(card);
    });
  }

  function renderEvents() {
    var grid = $("#eventsGrid"); if (!grid || !CFG.events) return;
    CFG.events.forEach(function (ev, i) {
      var card = el("article", "event-card reveal",
        figure(ev.image, ev.title) +
        '<div class="event-body"><h3>' + ev.title + '</h3><p>' + ev.desc + '</p></div>');
      card.style.transitionDelay = (i % 4) * 0.05 + "s";
      grid.appendChild(card);
    });
  }

  var galleryImages = [];
  function renderGallery() {
    var grid = $("#galleryGrid"); if (!grid || !CFG.gallery) return;
    CFG.gallery.forEach(function (g, i) {
      galleryImages.push({ src: IMG + g.image, label: g.label });
      var sizeCls = g.size === "tall" ? "g-tall" : g.size === "wide" ? "g-wide" : "";
      var item = el("button", "gallery-item reveal " + sizeCls, figure(g.image, g.label));
      item.setAttribute("type", "button");
      item.setAttribute("aria-label", "View " + g.label);
      item.dataset.index = i;
      item.style.transitionDelay = (i % 3) * 0.05 + "s";
      item.addEventListener("click", function () { openLightbox(parseInt(item.dataset.index, 10)); });
      grid.appendChild(item);
    });
  }

  function renderAbout() {
    var body = $("#aboutBody");
    if (body && CFG.about && CFG.about.body) {
      CFG.about.body.forEach(function (p) { body.appendChild(el("p", null, p)); });
    }
    var stats = $("#aboutStats");
    if (stats && CFG.about && CFG.about.stats) {
      CFG.about.stats.forEach(function (s) {
        stats.appendChild(el("li", "stat", "<strong>" + s.value + "</strong><span>" + s.label + "</span>"));
      });
    }
  }

  // Renders every phone number (supports one or many) into the Contact
  // section cards and the footer. The hero/header "Call Us" buttons use the
  // primary (first) number via the data-href-tel binding in bindConfig().
  function renderPhones() {
    var phones = get(CFG, "contact.phones");
    if (!phones || !phones.length) return;
    var phoneIco = '<svg class="ico" viewBox="0 0 24 24"><path d="M6.6 10.8a15.6 15.6 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1z"/></svg>';
    var ul = $("#contactCards");
    if (ul) {
      var anchor = ul.firstElementChild; // insert phone cards before Instagram/location
      phones.forEach(function (p) {
        var li = el("li", "contact-card reveal",
          '<span class="contact-card-ico">' + phoneIco + '</span>' +
          '<div><p class="contact-card-label">Phone</p>' +
          '<a class="contact-card-value" href="tel:' + p.href + '">' + p.display + '</a></div>');
        ul.insertBefore(li, anchor);
      });
    }
    var fp = $("#footerPhones");
    if (fp) {
      fp.style.display = "contents"; // let each line stack in the footer flex column
      phones.forEach(function (p) {
        var a = el("a", "footer-line", p.display);
        a.setAttribute("href", "tel:" + p.href);
        fp.appendChild(a);
      });
    }
  }

  function renderInstaGrid() {
    var grid = $("#instaGrid");
    if (!grid || !CFG.instagram || !CFG.instagram.tiles) return;
    var ig = get(CFG, "contact.instagramUrl") || "#";
    CFG.instagram.tiles.forEach(function (name) {
      var a = el("a", "insta-tile reveal", figure(name, "On Instagram"));
      a.href = ig; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "View on Instagram");
      grid.appendChild(a);
    });
  }

  /* =========================================================================
     3. REVEAL ON SCROLL
     ====================================================================== */
  function initReveals() {
    var items = $all(".reveal, #aboutBody p");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (i) { i.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (i) { io.observe(i); });
  }

  /* =========================================================================
     4. HEADER STATE + MOBILE NAV + SMOOTH ANCHORS
     ====================================================================== */
  function initHeader() {
    var header = $("#siteHeader");
    var hero = $("#hero");
    var toggle = $("#navToggle");
    var nav = $("#primaryNav");

    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      header.classList.toggle("scrolled", y > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var backdrop = $("#navBackdrop");
    var navClose = $("#navClose");
    function setMenu(open) {
      nav.classList.toggle("open", open);
      toggle.classList.toggle("open", open);
      if (backdrop) backdrop.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (toggle && nav) {
      toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
      // close on: a nav link, the × button, a click on the backdrop, or Escape
      $all("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      if (navClose) navClose.addEventListener("click", function () { setMenu(false); });
      if (backdrop) backdrop.addEventListener("click", function () { setMenu(false); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false);
      });
    }
  }

  /* =========================================================================
     5. SCROLL PROGRESS BAR
     ====================================================================== */
  function initProgress() {
    var bar = $("#progressBar"); if (!bar) return;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = p + "%";
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  /* =========================================================================
     6. CINEMATIC 3D SCROLL ENGINE
        - Hero: layered depth parallax + fade/scale as you leave
        - Feature3d: sticky scene scrubbed by scroll progress
        - Generic [data-parallax] elements
        Single rAF loop, reads scroll only when needed. Disabled for
        reduced-motion users.
     ====================================================================== */
  function initScrollScenes() {
    if (reduceMotion) return;

    var heroStage = $("#heroStage");
    var heroContent = $(".hero-content");
    var hero = $("#hero");
    var depthEls = $all("[data-depth]", hero);
    var parallaxEls = $all("[data-parallax]");

    var feature = $("#feature3d");
    var fSticky = $("#feature3dSticky");
    var floatCards = $all(".float-card");
    var plate = $("#plateRotor");
    var fCopy = $("#feature3dCopy");

    var mouseX = 0, mouseY = 0, curX = 0, curY = 0;
    var isFinePointer = window.matchMedia("(pointer:fine)").matches;
    var heroInView = true;
    var mouseRunning = false;

    var ticking = false;
    function requestTick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

    function frame() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      var vh = window.innerHeight;

      /* --- HERO depth + exit --- */
      if (hero && y < vh * 1.1) {
        // ease mouse
        curX += (mouseX - curX) * 0.06;
        curY += (mouseY - curY) * 0.06;
        var prog = Math.min(y / vh, 1); // 0 → 1 through first screen

        depthEls.forEach(function (elm) {
          var d = parseFloat(elm.getAttribute("data-depth")) || 0;
          var tx = curX * d;
          var ty = curY * d - y * (d * 0.012);
          elm.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
        });
        if (heroContent) {
          heroContent.style.opacity = String(1 - prog * 1.15);
          heroContent.style.transform = "translate3d(0," + (-y * 0.06) + "px,0) scale(" + (1 - prog * 0.06) + ")";
        }
      }

      /* --- Generic parallax --- */
      parallaxEls.forEach(function (elm) {
        var speed = parseFloat(elm.getAttribute("data-parallax")) || 0.1;
        var rect = elm.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < vh) {
          var offset = (rect.top - vh / 2) * -speed;
          elm.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
        }
      });

      /* --- FEATURE 3D sticky scrub --- */
      if (feature && fSticky) {
        var fTop = feature.offsetTop;
        var fHeight = feature.offsetHeight - vh; // scrollable range inside sticky
        var p = (y - fTop) / (fHeight || 1);
        p = Math.max(0, Math.min(1, p));         // 0 → 1 across the section
        // ease: cards fly from spread → center-ish, rotate + settle
        var e = p; // linear scrub reads best for scenes
        floatCards.forEach(function (card) {
          var d = parseFloat(card.getAttribute("data-fdepth")) || 1.5;
          var translate = (1 - e) * 120 * d;             // start far, converge
          var rot = (1 - e) * 8 * d;
          var scale = 0.75 + e * 0.35;
          var opa = Math.min(1, e * 1.6);
          card.style.transform = "translate3d(0," + translate + "px,0) rotate(" + rot + "deg) scale(" + scale + ")";
          card.style.opacity = String(opa);
        });
        if (plate) {
          // scales and fades in step with the satellites. No spin: the rings are
          // circular (rotation invisible) so it would only spin the photograph.
          plate.style.transform = "translate(-50%,-50%) scale(" + (0.82 + e * 0.22) + ")";
          plate.style.opacity = String(Math.min(1, e * 1.6));
        }
        if (fCopy) {
          var copyFade = e < 0.5 ? e * 2 : (1 - (e - 0.5) * 1.4);
          fCopy.style.opacity = String(Math.max(0.15, copyFade));
          fCopy.style.transform = "translate(-50%,calc(-50% + " + ((0.5 - e) * 40) + "px))";
        }
      }
    }

    // initialise the circles hidden before first paint (they fade in on scroll)
    floatCards.forEach(function (c) { c.style.opacity = "0"; });
    if (plate) plate.style.opacity = "0";

    // Continuous rAF loop is ONLY used to ease the hero mouse-parallax, and it
    // self-stops whenever the hero leaves the viewport (no wasted repaints).
    function mouseLoop() {
      if (!heroInView) { mouseRunning = false; return; }
      requestTick();
      // stop once the parallax has eased to rest — an idle page repaints nothing
      var settled = Math.abs(mouseX - curX) < 0.0015 && Math.abs(mouseY - curY) < 0.0015;
      if (settled) { mouseRunning = false; return; }
      requestAnimationFrame(mouseLoop);
    }
    function startMouseLoop() {
      if (isFinePointer && heroInView && !mouseRunning) { mouseRunning = true; mouseLoop(); }
    }

    if (isFinePointer && heroStage) {
      window.addEventListener("mousemove", function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5);
        mouseY = (e.clientY / window.innerHeight - 0.5);
        startMouseLoop();
      }, { passive: true });
    }
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        heroInView = entries[0].isIntersecting;
        if (heroInView) startMouseLoop();
      }, { threshold: 0 }).observe(hero);
    }

    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", requestTick);
    requestTick();
    startMouseLoop();
  }

  /* =========================================================================
     7. LIGHTBOX
     ====================================================================== */
  var lbIndex = 0;
  function openLightbox(i) {
    var lb = $("#lightbox"); if (!lb) return;
    lbIndex = i;
    setLightbox();
    lb.hidden = false;
    requestAnimationFrame(function () { lb.classList.add("open"); });
    document.body.style.overflow = "hidden";
    $("#lightboxClose").focus();
  }
  function setLightbox() {
    var item = galleryImages[lbIndex]; if (!item) return;
    var img = $("#lightboxImg");
    var fig = $("#lightboxFigure");
    fig.classList.remove("is-missing");
    fig.setAttribute("data-label", item.label);
    img.src = item.src; img.alt = item.label;
  }
  function closeLightbox() {
    var lb = $("#lightbox"); if (!lb) return;
    lb.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(function () { lb.hidden = true; }, 350);
  }
  function stepLightbox(dir) {
    lbIndex = (lbIndex + dir + galleryImages.length) % galleryImages.length;
    setLightbox();
  }
  function initLightbox() {
    var lb = $("#lightbox"); if (!lb) return;
    wireImageFallback($("#lightboxImg"));
    $("#lightboxClose").addEventListener("click", closeLightbox);
    $("#lightboxPrev").addEventListener("click", function () { stepLightbox(-1); });
    $("#lightboxNext").addEventListener("click", function () { stepLightbox(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  /* =========================================================================
     INIT
     ====================================================================== */
  function init() {
    bindConfig();
    initPhoneLinks();
    renderPhones();
    renderAbout();
    renderServices();
    renderMenu();
    renderEvents();
    renderGallery();
    // reviews (incl. testimonials grid) are owned by js/reviews.js
    renderInstaGrid();
    // wire fallbacks for every image now in the DOM
    $all(".media img").forEach(wireImageFallback);
    initReveals();
    initHeader();
    initProgress();
    initScrollScenes();
    initLightbox();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
