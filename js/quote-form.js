/* =============================================================================
   REQUEST A QUOTE — multi-step catering enquiry form
   -----------------------------------------------------------------------------
   Every option list is fetched from the Worker (GET /api/quote/config) and the
   fields are built from it, so the choices a customer sees and the choices the
   server accepts cannot drift apart. Nothing is hard-coded here.

   Answers are kept in sessionStorage while the form is being filled in, so a
   refresh or a stray back-button does not destroy several minutes of work.
   Files are never stored there — only what the customer typed. Everything is
   cleared once the enquiry is accepted.

   Validation here is for the customer's benefit. The Worker validates the same
   rules again and is the only thing that decides what is stored.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var API = CFG.reviewsApi || {};
  var BASE = API.url ? String(API.url).replace(/\/+$/, "") : "";
  var STORE_KEY = "yrc-quote-draft-v1";

  var C = null;             // config from the Worker
  var data = {};            // the customer's answers
  var files = [];           // File objects, never persisted
  var step = 0;
  var sending = false;

  var $ = function (s, c) { return (c || document).querySelector(s); };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var STEPS = [
    { key: "you",      title: "Your Details" },
    { key: "event",    title: "Your Event" },
    { key: "catering", title: "Catering Requirements" },
    { key: "extras",   title: "Additional Details" },
    { key: "review",   title: "Review & Submit" }
  ];

  /* ------------------------------------------------------------- storage */
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ data: data, step: step })); } catch (e) {}
  }
  function restore() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && saved.data) { data = saved.data; step = Math.min(saved.step || 0, STEPS.length - 1); }
    } catch (e) {}
  }
  function clearSaved() { try { sessionStorage.removeItem(STORE_KEY); } catch (e) {} }

  /* --------------------------------------------------------- field types */
  function fieldWrap(id, labelText, control, opts) {
    opts = opts || {};
    return '<div class="qf" data-for="' + id + '">' +
      '<label for="' + id + '">' + esc(labelText) +
        (opts.required ? ' <span class="req" aria-hidden="true">*</span>' : '') +
        (opts.hint ? ' <em>' + esc(opts.hint) + '</em>' : '') +
      '</label>' + control +
      '<span class="qf-err" id="' + id + '-err" hidden></span>' +
    '</div>';
  }

  function textInput(id, labelText, opts) {
    opts = opts || {};
    var v = data[id] == null ? "" : data[id];
    var attrs = 'id="' + id + '" name="' + id + '" value="' + esc(v) + '"' +
      ' type="' + (opts.type || "text") + '"' +
      (opts.maxlength ? ' maxlength="' + opts.maxlength + '"' : "") +
      (opts.min != null ? ' min="' + opts.min + '"' : "") +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "") +
      (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : "") +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "");
    return fieldWrap(id, labelText, "<input " + attrs + " />", opts);
  }

  function textArea(id, labelText, opts) {
    opts = opts || {};
    var v = data[id] == null ? "" : data[id];
    return fieldWrap(id, labelText,
      '<textarea id="' + id + '" name="' + id + '" rows="' + (opts.rows || 4) +
      '" maxlength="' + (opts.maxlength || C.limits.longText) + '"' +
      (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") + '>' + esc(v) + '</textarea>', opts);
  }

  function select(id, labelText, list, opts) {
    opts = opts || {};
    var v = data[id] == null ? (opts.defaultValue || "") : data[id];
    var options = '<option value="">' + esc(opts.blank || "Please choose…") + '</option>' +
      list.map(function (o) {
        return '<option value="' + esc(o.value) + '"' + (v === o.value ? " selected" : "") + '>' + esc(o.label) + '</option>';
      }).join("");
    return fieldWrap(id, labelText, '<select id="' + id + '" name="' + id + '">' + options + '</select>', opts);
  }

  function checkGroup(id, labelText, list, opts) {
    opts = opts || {};
    var chosen = data[id] || [];
    var boxes = list.map(function (o, i) {
      var cid = id + "-" + i;
      return '<label class="qf-opt" for="' + cid + '">' +
        '<input type="checkbox" id="' + cid + '" name="' + id + '" value="' + esc(o.value) + '"' +
        (chosen.indexOf(o.value) > -1 ? " checked" : "") + ' />' +
        '<span>' + esc(o.label) + '</span></label>';
    }).join("");
    return '<fieldset class="qf qf-group" data-for="' + id + '">' +
      '<legend>' + esc(labelText) + (opts.required ? ' <span class="req" aria-hidden="true">*</span>' : '') +
      (opts.hint ? ' <em>' + esc(opts.hint) + '</em>' : '') + '</legend>' +
      '<div class="qf-opts">' + boxes + '</div>' +
      '<span class="qf-err" id="' + id + '-err" hidden></span></fieldset>';
  }

  function radioGroup(id, labelText, list, opts) {
    opts = opts || {};
    var v = data[id] == null ? "" : data[id];
    var boxes = list.map(function (o, i) {
      var rid = id + "-" + i;
      return '<label class="qf-opt" for="' + rid + '">' +
        '<input type="radio" id="' + rid + '" name="' + id + '" value="' + esc(o.value) + '"' +
        (v === o.value ? " checked" : "") + ' />' +
        '<span>' + esc(o.label) + '</span></label>';
    }).join("");
    return '<fieldset class="qf qf-group" data-for="' + id + '">' +
      '<legend>' + esc(labelText) + (opts.required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</legend>' +
      '<div class="qf-opts qf-opts--inline">' + boxes + '</div>' +
      '<span class="qf-err" id="' + id + '-err" hidden></span></fieldset>';
  }

  /* --------------------------------------------------------------- steps */
  function today() { return new Date().toISOString().slice(0, 10); }

  function renderStep(n) {
    var s = STEPS[n].key;

    if (s === "you") {
      return '<h2 class="qf-h">Your details</h2>' +
        '<p class="qf-sub">So we know who we’re preparing this for.</p>' +
        textInput("full_name", "Full name", { required: true, maxlength: 120, autocomplete: "name" }) +
        '<div class="qf-row">' +
          textInput("email", "Email address", { required: true, type: "email", inputmode: "email", autocomplete: "email", maxlength: 160 }) +
          textInput("phone", "Phone number", { required: true, type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "+40 712 345 678", maxlength: 32 }) +
        '</div>' +
        radioGroup("preferred_contact", "How would you prefer we reply?", C.preferredContact) +
        '<h3 class="qf-h3">Your address <em>(optional)</em></h3>' +
        textInput("address_line", "Street address", { maxlength: 200, autocomplete: "street-address" }) +
        '<div class="qf-row">' +
          textInput("city", "City", { maxlength: 120, autocomplete: "address-level2" }) +
          textInput("region", "County / region", { maxlength: 120, autocomplete: "address-level1" }) +
        '</div>' +
        textInput("postcode", "Postcode", { maxlength: 20, autocomplete: "postal-code" });
    }

    if (s === "event") {
      return '<h2 class="qf-h">Your event</h2>' +
        '<p class="qf-sub">The essentials we need to understand the occasion.</p>' +
        select("event_type", "Event type", C.eventTypes, { required: true }) +
        '<div id="wrap-event_type_other"' + (data.event_type === "other" ? "" : " hidden") + '>' +
          textArea("event_type_other", "Please describe your event", { rows: 2, maxlength: C.limits.mediumText }) +
        '</div>' +
        '<div class="qf-row">' +
          textInput("event_date", "Event date", { required: true, type: "date", min: today() }) +
          textInput("guest_count", "Number of guests", { required: true, type: "number", min: 1, inputmode: "numeric" }) +
        '</div>' +
        '<div class="qf-row">' +
          textInput("start_time", "Start time", { type: "time" }) +
          textInput("end_time", "Expected end time", { type: "time" }) +
          textInput("child_guest_count", "Of which children", { type: "number", min: 0, inputmode: "numeric" }) +
        '</div>' +
        select("venue_status", "Where are you with the venue?", C.venueStatuses) +
        '<h3 class="qf-h3">Venue <em>(if you know it)</em></h3>' +
        '<p class="qf-note">Not decided yet? Leave this blank and carry on.</p>' +
        textInput("venue_name", "Venue name", { maxlength: 200 }) +
        textInput("venue_address", "Venue address", { maxlength: 200 }) +
        '<div class="qf-row">' +
          textInput("venue_city", "City", { maxlength: 120 }) +
          textInput("venue_region", "County / region", { maxlength: 120 }) +
        '</div>' +
        textInput("venue_postcode", "Postcode", { maxlength: 20 });
    }

    if (s === "catering") {
      return '<h2 class="qf-h">Catering requirements</h2>' +
        '<p class="qf-sub">Tell us what you’d like us to look after.</p>' +
        checkGroup("catering_services", "What catering are you interested in?", C.cateringServices, { required: true, hint: "(choose any that apply)" }) +
        '<div id="wrap-catering_services_other"' + ((data.catering_services || []).indexOf("other") > -1 ? "" : " hidden") + '>' +
          textArea("catering_services_other", "Please describe what you need", { rows: 2, maxlength: C.limits.mediumText }) +
        '</div>' +
        checkGroup("meal_requirements", "Which parts of the event need catering?", C.mealRequirements, { hint: "(choose any that apply)" }) +
        select("food_style", "Preferred food style", C.foodStyles) +
        '<div id="wrap-food_style_other"' + (data.food_style === "other" ? "" : " hidden") + '>' +
          textArea("food_style_other", "Please describe the style you have in mind", { rows: 2, maxlength: C.limits.mediumText }) +
        '</div>' +
        radioGroup("existing_menu", "Do you already have a menu in mind?", C.menuAnswers) +
        '<div id="wrap-menu_description"' + (data.existing_menu === "yes" ? "" : " hidden") + '>' +
          textArea("menu_description", "Tell us what you would like served", { rows: 4 }) +
        '</div>' +
        '<h3 class="qf-h3">Dietary requirements</h3>' +
        '<p class="qf-note">Please be as complete as you can — we plan the whole menu around this.</p>' +
        checkGroup("dietary_requirements", "Any dietary requirements or allergies?", C.dietaryRequirements) +
        '<div id="wrap-dietary_details"' + hasDietary() + '>' +
          textArea("dietary_details", "Please give us further details", { rows: 3, required: true }) +
          textInput("affected_guest_count", "Approximate number of guests affected", { type: "number", min: 0, inputmode: "numeric" }) +
        '</div>';
    }

    if (s === "extras") {
      var u = C.uploads;
      return '<h2 class="qf-h">Additional details</h2>' +
        '<p class="qf-sub">The finishing touches. Everything here is optional.</p>' +
        checkGroup("event_style", "Tell us about the style of your event", C.eventStyles) +
        textInput("theme_colours", "Theme or colours", { maxlength: 200 }) +
        select("approximate_budget", "Approximate catering budget", C.budgets, { blank: "Please choose…" }) +
        '<p class="qf-note">This helps us shape a realistic proposal. It is not a quote — we’ll confirm pricing ourselves.</p>' +
        select("referral_source", "How did you hear about us?", C.referralSources) +
        textArea("additional_information", "Anything else we should know?", { rows: 5,
          placeholder: "Special requests, timings, cultural requirements, venue or access restrictions, kitchen facilities, parking…" }) +
        '<h3 class="qf-h3">Attachments <em>(optional)</em></h3>' +
        '<p class="qf-note">Venue photos, inspiration, a seating plan or an event brief. ' +
          'Up to ' + u.maxFiles + ' files, ' + Math.round(u.maxBytes / 1048576) + ' MB each — ' +
          u.accept.join(", ").toUpperCase() + '.</p>' +
        '<div class="qf">' +
          '<input type="file" id="attachments" multiple accept="' + u.acceptMime.join(",") + '" />' +
          '<ul class="qf-files" id="fileList"></ul>' +
          '<span class="qf-err" id="attachments-err" hidden></span>' +
        '</div>';
    }

    return renderReview();
  }

  function hasDietary() {
    var d = data.dietary_requirements || [];
    var beyondNone = d.some(function (x) { return x !== "none"; });
    return beyondNone ? "" : " hidden";
  }

  /* -------------------------------------------------------------- review */
  function labelOf(list, value) {
    if (!value) return "";
    for (var i = 0; i < list.length; i++) if (list[i].value === value) return list[i].label;
    return value;
  }
  function labelsOf(list, values) {
    return (values || []).map(function (v) { return labelOf(list, v); }).filter(Boolean);
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  function block(title, stepIndex, rows) {
    var body = rows.filter(function (r) { return r[1]; })
      .map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join("");
    if (!body) return "";
    return '<section class="qr-block"><header><h3>' + esc(title) + '</h3>' +
      '<button type="button" class="qr-edit" data-goto="' + stepIndex + '">Edit</button></header>' +
      '<dl>' + body + '</dl></section>';
  }

  function renderReview() {
    var addr = [data.address_line, data.city, data.region, data.postcode].filter(Boolean).join(", ");
    var venue = [data.venue_name, data.venue_address, data.venue_city, data.venue_region, data.venue_postcode].filter(Boolean).join(", ");
    var dietary = labelsOf(C.dietaryRequirements, data.dietary_requirements).join(", ");

    return '<h2 class="qf-h">Review your enquiry</h2>' +
      '<p class="qf-sub">Please check everything over. You can change any section before sending.</p>' +
      block("Contact details", 0, [
        ["Name", data.full_name], ["Email", data.email], ["Phone", data.phone],
        ["Preferred contact", labelOf(C.preferredContact, data.preferred_contact)],
        ["Address", addr]
      ]) +
      block("Event details", 1, [
        ["Event type", labelOf(C.eventTypes, data.event_type) + (data.event_type_other ? " — " + data.event_type_other : "")],
        ["Date", fmtDate(data.event_date)],
        ["Times", [data.start_time, data.end_time].filter(Boolean).join(" – ")],
        ["Guests", data.guest_count ? data.guest_count + (data.child_guest_count ? " (" + data.child_guest_count + " children)" : "") : ""],
        ["Venue status", labelOf(C.venueStatuses, data.venue_status)],
        ["Venue", venue]
      ]) +
      block("Catering requirements", 2, [
        ["Services", labelsOf(C.cateringServices, data.catering_services).join(", ")],
        ["Other", data.catering_services_other],
        ["Meal parts", labelsOf(C.mealRequirements, data.meal_requirements).join(", ")],
        ["Food style", labelOf(C.foodStyles, data.food_style) + (data.food_style_other ? " — " + data.food_style_other : "")],
        ["Menu in mind", labelOf(C.menuAnswers, data.existing_menu)],
        ["Menu request", data.menu_description]
      ]) +
      block("Dietary requirements", 2, [
        ["Requirements", dietary],
        ["Details", data.dietary_details],
        ["Guests affected", data.affected_guest_count]
      ]) +
      block("Event style", 3, [
        ["Style", labelsOf(C.eventStyles, data.event_style).join(", ")],
        ["Theme / colours", data.theme_colours]
      ]) +
      block("Budget", 3, [["Approximate budget", labelOf(C.budgets, data.approximate_budget)]]) +
      block("Additional information", 3, [
        ["Heard about us", labelOf(C.referralSources, data.referral_source)],
        ["Notes", data.additional_information],
        ["Attachments", files.length ? files.map(function (f) { return f.name; }).join(", ") : ""]
      ]) +
      '<div class="qf qf-consent">' +
        '<label class="qf-opt" for="privacy_consent">' +
          '<input type="checkbox" id="privacy_consent" name="privacy_consent"' + (data.privacy_consent ? " checked" : "") + ' />' +
          '<span>I agree that Yeshua Royal Catering Services may use the information provided to' +
          ' respond to my catering enquiry. <span class="req" aria-hidden="true">*</span></span>' +
        '</label>' +
        '<span class="qf-err" id="privacy_consent-err" hidden></span>' +
      '</div>' +
      // Hidden from people, tempting to simple bots. Anything typed in here
      // causes the Worker to reject the submission.
      '<div class="qf-hp" aria-hidden="true">' +
        '<label for="website">Website</label>' +
        '<input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />' +
      '</div>';
  }

  /* ---------------------------------------------------------- collecting */
  function collect() {
    var root = $("#quoteSections");
    if (!root) return;

    Array.prototype.forEach.call(root.querySelectorAll("input, select, textarea"), function (el) {
      if (el.type === "file") return;
      var name = el.name;
      if (!name) return;

      if (el.type === "checkbox") {
        if (name === "privacy_consent") { data.privacy_consent = el.checked; return; }
        if (name === "website") return;
        data[name] = data[name] || [];
        var at = data[name].indexOf(el.value);
        if (el.checked && at === -1) data[name].push(el.value);
        if (!el.checked && at > -1) data[name].splice(at, 1);
      } else if (el.type === "radio") {
        if (el.checked) data[name] = el.value;
      } else {
        data[name] = el.value;
      }
    });
    save();
  }

  /* ---------------------------------------------------------- validation */
  function fieldError(id, message) {
    var err = document.getElementById(id + "-err");
    var wrap = $('[data-for="' + id + '"]');
    if (err) { err.textContent = message || ""; err.hidden = !message; }
    if (wrap) wrap.classList.toggle("has-error", !!message);
    return !message;
  }

  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll(".qf-err"), function (e) { e.hidden = true; e.textContent = ""; });
    Array.prototype.forEach.call(document.querySelectorAll(".has-error"), function (e) { e.classList.remove("has-error"); });
  }

  function validateStep(n) {
    clearErrors();
    var ok = true;
    var first = null;
    var fail = function (id, msg) {
      fieldError(id, msg);
      if (!first) first = id;
      ok = false;
    };

    var s = STEPS[n].key;

    if (s === "you") {
      if (!(data.full_name || "").trim() || data.full_name.trim().length < 2) fail("full_name", "Please tell us your name.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((data.email || "").trim())) fail("email", "Please enter a valid email address.");
      var digits = (data.phone || "").replace(/[^\d]/g, "");
      if (digits.length < 6) fail("phone", "Please enter a phone number we can reach you on.");
    }

    if (s === "event") {
      if (!data.event_type) fail("event_type", "Please choose the type of event.");
      if (data.event_type === "other" && !(data.event_type_other || "").trim()) fail("event_type_other", "Please describe your event.");
      if (!data.event_date) fail("event_date", "Please choose your event date.");
      else if (data.event_date < today()) fail("event_date", "That date has already passed.");
      var g = Number(data.guest_count);
      if (!data.guest_count || !Number.isInteger(g) || g < 1) fail("guest_count", "Please enter the number of guests (at least 1).");
      if (data.child_guest_count) {
        var ch = Number(data.child_guest_count);
        if (!Number.isInteger(ch) || ch < 0) fail("child_guest_count", "That is not a valid number.");
        else if (g && ch > g) fail("child_guest_count", "That is more than the total number of guests.");
      }
      if (data.start_time && data.end_time && data.end_time <= data.start_time) {
        fail("end_time", "The end time should be after the start time.");
      }
    }

    if (s === "catering") {
      if (!(data.catering_services || []).length) fail("catering_services", "Please choose at least one option.");
      if ((data.catering_services || []).indexOf("other") > -1 && !(data.catering_services_other || "").trim()) {
        fail("catering_services_other", "Please describe what you need.");
      }
      if (data.food_style === "other" && !(data.food_style_other || "").trim()) fail("food_style_other", "Please describe the style.");
      if (data.existing_menu === "yes" && !(data.menu_description || "").trim()) fail("menu_description", "Please tell us what you would like served.");
      var d = data.dietary_requirements || [];
      if (d.some(function (x) { return x !== "none"; }) && !(data.dietary_details || "").trim()) {
        fail("dietary_details", "Please give us the details so we can cater safely.");
      }
    }

    if (s === "review") {
      if (!data.privacy_consent) fail("privacy_consent", "Please agree to this so we can reply to your enquiry.");
    }

    if (!ok && first) {
      var el = document.getElementById(first) || $('[data-for="' + first + '"]');
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (el.focus) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      }
    }
    return ok;
  }

  /* ------------------------------------------------------------ painting */
  function paintProgress() {
    var ol = $("#quoteSteps");
    ol.innerHTML = STEPS.map(function (s, i) {
      var state = i === step ? "on" : (i < step ? "done" : "");
      return '<li class="' + state + '">' +
        '<button type="button" data-goto="' + i + '"' + (i > step ? " disabled" : "") + '>' +
          '<span class="n">' + (i + 1) + '</span><span class="t">' + esc(s.title) + '</span>' +
        '</button></li>';
    }).join("");
  }

  function paint() {
    $("#quoteSections").innerHTML = renderStep(step);
    paintProgress();

    var last = step === STEPS.length - 1;
    $("#quoteBack").hidden = step === 0;
    $("#quoteNext").hidden = last;
    $("#quoteSubmit").hidden = !last;
    $("#quoteError").hidden = true;

    if (step === 3) paintFiles();
    wireStep();
    save();

    var h = $(".quote-intro");
    if (h) h.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* Fields that only make sense once another answer is given. */
  function toggleConditionals() {
    var pairs = [
      ["wrap-event_type_other", data.event_type === "other"],
      ["wrap-catering_services_other", (data.catering_services || []).indexOf("other") > -1],
      ["wrap-food_style_other", data.food_style === "other"],
      ["wrap-menu_description", data.existing_menu === "yes"],
      ["wrap-dietary_details", (data.dietary_requirements || []).some(function (x) { return x !== "none"; })]
    ];
    pairs.forEach(function (p) {
      var el = document.getElementById(p[0]);
      if (el) el.hidden = !p[1];
    });
  }

  function wireStep() {
    var root = $("#quoteSections");

    root.addEventListener("input", onChange);
    root.addEventListener("change", onChange);

    Array.prototype.forEach.call(root.querySelectorAll("[data-goto]"), function (b) {
      b.addEventListener("click", function () { collect(); step = Number(b.getAttribute("data-goto")); paint(); });
    });

    var picker = document.getElementById("attachments");
    if (picker) picker.addEventListener("change", onFiles);
  }

  function onChange(e) {
    // "None" and a specific requirement are mutually exclusive.
    if (e.target.name === "dietary_requirements") {
      var boxes = document.querySelectorAll('input[name="dietary_requirements"]');
      if (e.target.value === "none" && e.target.checked) {
        Array.prototype.forEach.call(boxes, function (b) { if (b.value !== "none") b.checked = false; });
      } else if (e.target.value !== "none" && e.target.checked) {
        Array.prototype.forEach.call(boxes, function (b) { if (b.value === "none") b.checked = false; });
      }
      data.dietary_requirements = [];
    }
    if (e.target.name === "catering_services" ||
        e.target.name === "meal_requirements" || e.target.name === "event_style") {
      data[e.target.name] = [];
    }
    collect();
    toggleConditionals();
  }

  /* --------------------------------------------------------------- files */
  function onFiles(e) {
    var u = C.uploads;
    var picked = Array.prototype.slice.call(e.target.files || []);
    var err = document.getElementById("attachments-err");
    var problems = [];

    picked.forEach(function (f) {
      var ext = f.name.split(".").pop().toLowerCase();
      if (u.accept.indexOf(ext) === -1) { problems.push('"' + f.name + '" is not an accepted type.'); return; }
      if (f.size > u.maxBytes) { problems.push('"' + f.name + '" is larger than ' + Math.round(u.maxBytes / 1048576) + ' MB.'); return; }
      if (files.length >= u.maxFiles) { problems.push("You can attach up to " + u.maxFiles + " files."); return; }
      files.push(f);
    });

    e.target.value = "";
    if (err) { err.textContent = problems.join(" "); err.hidden = !problems.length; }
    paintFiles();
  }

  function paintFiles() {
    var list = document.getElementById("fileList");
    if (!list) return;
    list.innerHTML = files.map(function (f, i) {
      return '<li><span>' + esc(f.name) + '</span>' +
        '<span class="qf-file-size">' + Math.round(f.size / 1024) + ' KB</span>' +
        '<button type="button" class="qf-file-x" data-i="' + i + '" aria-label="Remove ' + esc(f.name) + '">&times;</button></li>';
    }).join("");
    Array.prototype.forEach.call(list.querySelectorAll(".qf-file-x"), function (b) {
      b.addEventListener("click", function () { files.splice(Number(b.getAttribute("data-i")), 1); paintFiles(); });
    });
  }

  /* -------------------------------------------------------------- submit */
  function submit(e) {
    e.preventDefault();
    if (sending) return;                       // guards against a double click
    collect();
    if (!validateStep(step)) return;

    var btn = $("#quoteSubmit");
    var err = $("#quoteError");
    sending = true;
    btn.disabled = true;
    btn.textContent = "Sending…";
    err.hidden = true;

    var payload = {};
    Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
    payload.website = (document.getElementById("website") || {}).value || "";

    var body = new FormData();
    body.append("payload", JSON.stringify(payload));
    files.forEach(function (f) { body.append("files", f, f.name); });

    fetch(BASE + "/api/quote/enquiries", { method: "POST", body: body })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
          return d;
        });
      })
      .then(function (result) {
        clearSaved();
        showConfirmation(result);
      })
      .catch(function (ex) {
        // The customer's answers are deliberately left untouched here.
        err.textContent = ex.message && ex.message.length < 200
          ? ex.message
          : "Something went wrong while sending your enquiry. Your information has been kept — please try again.";
        err.hidden = false;
        err.scrollIntoView({ block: "center", behavior: "smooth" });
      })
      .then(function () {
        sending = false;
        btn.disabled = false;
        btn.textContent = "Send My Catering Enquiry";
      });
  }

  function showConfirmation(r) {
    $("#quoteForm").hidden = true;
    $(".quote-progress").hidden = true;
    var done = $("#quoteDone");

    var rows = [
      ["Event", labelOf(C.eventTypes, r.event_type)],
      ["Date", fmtDate(r.event_date)],
      ["Location", r.city],
      ["Guests", r.guest_count],
      ["Catering", labelsOf(C.cateringServices, r.catering_services).join(", ")]
    ].filter(function (x) { return x[1]; });

    done.innerHTML =
      '<div class="quote-done-inner">' +
        '<p class="eyebrow">Enquiry received</p>' +
        '<h2>Thank you, ' + esc(r.first_name) + '</h2>' +
        '<p class="quote-done-lead">Our team will review your event requirements and contact you' +
        ' regarding your catering proposal.</p>' +
        '<p class="quote-ref">Enquiry reference<strong>' + esc(r.reference) + '</strong></p>' +
        '<dl class="quote-done-summary">' +
          rows.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join("") +
          (r.attachments ? '<dt>Attachments</dt><dd>' + r.attachments + ' file(s) received</dd>' : "") +
        '</dl>' +
        '<a class="btn btn-gold btn-lg" href="../index.html">Return to Homepage</a>' +
      '</div>';
    done.hidden = false;
    done.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  /* ---------------------------------------------------------------- init */
  /* The quote page deliberately does not load main.js — that file owns the
     homepage's scroll scenes, gallery and lightbox, none of which exist here.
     These two bindings are all it needs from the shared config. */
  function bindConfig() {
    var get = function (path) {
      return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, CFG);
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-text]"), function (n) {
      var v = get(n.getAttribute("data-text"));
      if (v != null) n.textContent = v;
    });
    var tel = (get("contact.phoneHref") || "").replace(/\s+/g, "");
    Array.prototype.forEach.call(document.querySelectorAll("[data-href-tel]"), function (n) {
      n.setAttribute("href", "tel:" + tel);
    });
  }

  function init() {
    var form = $("#quoteForm");
    if (!form) return;

    bindConfig();
    if (!BASE) return unavailable();

    fetch(BASE + "/api/quote/config")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("config")); })
      .then(function (cfg) {
        C = cfg;
        restore();
        $("#quoteLoading").hidden = true;
        form.hidden = false;
        $("#quoteAutosave").hidden = false;
        paint();

        $("#quoteNext").addEventListener("click", function () {
          collect();
          if (!validateStep(step)) return;
          step = Math.min(step + 1, STEPS.length - 1);
          paint();
        });
        $("#quoteBack").addEventListener("click", function () {
          collect();                       // going back never loses an answer
          step = Math.max(step - 1, 0);
          paint();
        });
        form.addEventListener("submit", submit);
      })
      .catch(unavailable);
  }

  function unavailable() {
    var l = $("#quoteLoading"); if (l) l.hidden = true;
    var f = $("#quoteForm"); if (f) f.hidden = true;
    var p = $(".quote-progress"); if (p) p.hidden = true;
    var u = $("#quoteUnavailable"); if (u) u.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
