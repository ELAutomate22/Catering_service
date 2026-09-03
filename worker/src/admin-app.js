/* =============================================================================
   ADMIN APP — a single self-contained page served by the Worker.
   -----------------------------------------------------------------------------
   No build step, no framework, no third-party script, which is what lets the
   page run under a strict Content-Security-Policy with no external origins.

   The markup below is public (anyone may fetch /admin); it contains no data.
   Everything of value arrives from /api/admin/*, and every one of those routes
   independently verifies the session server-side. Signing in only decides what
   the page bothers to ask for.

   Note for editors: the app's own JavaScript deliberately avoids backticks and
   ${...} so it can live inside this template literal without escaping.
   ========================================================================== */

export function adminPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Yeshua Royal Catering — Admin</title>
<style>
:root{
  --ink:#211A38; --ink-soft:#473E63; --muted:#7C7488; --line:#E4DCEB;
  --bg:#F7F5FA; --card:#fff; --gold:#B8924A; --purple:#2E1A47;
  --ok:#1F7A44; --warn:#B7791F; --bad:#B3261E;
  --serif:"Cormorant Garamond",Georgia,serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  --radius:12px; --shadow:0 1px 2px rgba(33,26,56,.06),0 8px 24px rgba(33,26,56,.06);
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5}
a{color:inherit}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0}
button{font:inherit;cursor:pointer}
input,select,textarea{font:inherit;color:inherit;width:100%;padding:.6rem .75rem;border:1px solid var(--line);border-radius:8px;background:#fff}
input:focus,select:focus,textarea:focus,button:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
label{display:block;font-size:.8rem;font-weight:600;color:var(--ink-soft);margin-bottom:.3rem}
.btn{border:1px solid var(--line);background:#fff;border-radius:8px;padding:.6rem 1rem;font-weight:600;font-size:.88rem}
.btn:hover{border-color:var(--ink-soft)}
.btn-primary{background:var(--purple);color:#fff;border-color:var(--purple)}
.btn-primary:hover{background:#3D2560}
.btn-gold{background:var(--gold);color:#fff;border-color:var(--gold)}
.btn-sm{padding:.35rem .7rem;font-size:.8rem}
.muted{color:var(--muted)}
.hide{display:none !important}

/* login */
.login-wrap{min-height:100dvh;display:grid;place-items:center;padding:1.5rem;background:linear-gradient(160deg,var(--purple),#170e2b)}
.login{background:#fff;border-radius:16px;padding:2.2rem;width:100%;max-width:400px;box-shadow:0 30px 80px rgba(0,0,0,.3)}
.login h1{font-size:1.6rem;text-align:center}
.login .sub{text-align:center;color:var(--muted);font-size:.85rem;margin:.2rem 0 1.6rem;letter-spacing:.14em;text-transform:uppercase}
.login .field{margin-bottom:1rem}

/* shell */
.shell{display:grid;grid-template-columns:230px 1fr;min-height:100dvh}
.side{background:var(--purple);color:#EDE7F5;padding:1.4rem 1rem;display:flex;flex-direction:column;gap:.2rem}
.side .brand{font-family:var(--serif);font-size:1.15rem;color:#fff;margin-bottom:.1rem}
.side .brandsub{font-size:.66rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:1.6rem}
.side a{display:block;padding:.6rem .8rem;border-radius:8px;text-decoration:none;font-size:.9rem;color:#D9D0E8}
.side a:hover{background:rgba(255,255,255,.08);color:#fff}
.side a.on{background:rgba(184,146,74,.22);color:#fff;font-weight:600}
.side .spacer{flex:1}
.side .who{font-size:.75rem;color:#A79CBE;padding:.6rem .8rem;border-top:1px solid rgba(255,255,255,.12);margin-top:.6rem}
.main{padding:1.8rem 2rem;max-width:1400px}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.4rem;flex-wrap:wrap}
.page-head h2{font-size:1.75rem}

/* cards */
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.8rem;margin-bottom:1.8rem}
.stat{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:1rem;box-shadow:var(--shadow)}
.stat .n{font-size:1.7rem;font-family:var(--serif);font-weight:600}
.stat .l{font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:1.2rem;overflow:hidden}
.card>h3{padding:.9rem 1.1rem;border-bottom:1px solid var(--line);font-size:1.05rem}
.card .body{padding:1.1rem}

/* table */
table{width:100%;border-collapse:collapse;font-size:.86rem}
th{text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:.6rem 1.1rem;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:.75rem 1.1rem;border-bottom:1px solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:#FAF8FC;cursor:pointer}
.ref{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.8rem;color:var(--ink-soft)}

/* badges */
.badge{display:inline-block;padding:.2rem .55rem;border-radius:999px;font-size:.72rem;font-weight:600;white-space:nowrap;border:1px solid transparent}
.s-new{background:#E8F0FE;color:#1A4FA0;border-color:#C6DAFB}
.s-reviewing{background:#EDE9FE;color:#5B3FBF;border-color:#DBD2FC}
.s-contacted{background:#E7F6EC;color:#1F7A44;border-color:#C8E9D5}
.s-quote_preparing{background:#FEF3C7;color:#92610A;border-color:#FBE2A0}
.s-quote_sent{background:#FFEDD5;color:#9A4B0B;border-color:#FCD5AC}
.s-awaiting_response{background:#F3F0FF;color:#6B4FCF;border-color:#E2DAFB}
.s-confirmed{background:#DCFCE7;color:#166534;border-color:#B7F0C9}
.s-declined,.s-cancelled{background:#F3F4F6;color:#4B5563;border-color:#E2E5EA}
.p-high{background:#FEF3C7;color:#92610A;border-color:#FBE2A0}
.p-urgent{background:#FEE2E2;color:#B3261E;border-color:#FBC9C6}
.alert{background:#FEE2E2;border:1px solid #FBC9C6;color:#8C1D18;border-radius:8px;padding:.8rem 1rem;font-size:.87rem;margin-bottom:1rem}
.notice{background:#FEF6E7;border:1px solid #F5DFAE;color:#7A5310;border-radius:8px;padding:.8rem 1rem;font-size:.87rem}

/* filters */
.filters{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:.7rem;margin-bottom:1rem}

/* detail */
.grid2{display:grid;grid-template-columns:1fr 340px;gap:1.2rem;align-items:start}
.kv{display:grid;grid-template-columns:170px 1fr;gap:.5rem 1rem;font-size:.88rem}
.kv dt{color:var(--muted);font-size:.8rem}
.kv dd{margin:0}
.chips{display:flex;flex-wrap:wrap;gap:.35rem}
.chip{background:#F1EDF7;border:1px solid var(--line);border-radius:999px;padding:.2rem .6rem;font-size:.78rem}
.allergy{background:#FEE2E2;border:1px solid #F5B9B5;border-radius:var(--radius);padding:1rem}
.allergy h4{margin:0 0 .5rem;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:#8C1D18}
.timeline{list-style:none;margin:0;padding:0;font-size:.84rem}
.timeline li{padding:.55rem 0 .55rem 1rem;border-left:2px solid var(--line);position:relative}
.timeline li:before{content:"";position:absolute;left:-5px;top:.9rem;width:8px;height:8px;border-radius:50%;background:var(--gold)}
.note{background:#FAF8FC;border:1px solid var(--line);border-radius:8px;padding:.7rem .85rem;margin-bottom:.6rem;font-size:.86rem}
.note .meta{font-size:.72rem;color:var(--muted);margin-top:.35rem}
.files a{display:flex;justify-content:space-between;gap:1rem;padding:.6rem .75rem;border:1px solid var(--line);border-radius:8px;margin-bottom:.5rem;text-decoration:none;font-size:.85rem}
.files a:hover{border-color:var(--gold)}
.row{display:flex;gap:.6rem;flex-wrap:wrap;align-items:end}
.row>*{flex:1 1 120px}
.saved{color:var(--ok);font-size:.8rem}
.btn-danger{background:#fff;color:var(--bad);border-color:#F0C0BC}
.btn-danger:hover{background:var(--bad);color:#fff;border-color:var(--bad)}
.danger-zone{margin-top:1.2rem;padding-top:1rem;border-top:1px solid var(--line)}
.danger-zone p{margin:0 0 .7rem;font-size:.78rem;color:var(--muted);line-height:1.45}

@media(max-width:900px){
  .shell{grid-template-columns:1fr}
  .side{flex-direction:row;flex-wrap:wrap;align-items:center;gap:.4rem;padding:.8rem 1rem}
  .side .brand,.side .brandsub{margin:0 .8rem 0 0}
  .side .brandsub{display:none}
  .side .spacer{display:none}
  .side .who{border:0;margin:0;padding:.4rem}
  .main{padding:1.2rem}
  .grid2{grid-template-columns:1fr}
  .kv{grid-template-columns:1fr;gap:.15rem .5rem}
  .kv dt{margin-top:.5rem}
  /* Tables become stacked cards rather than something you scroll sideways. */
  table,thead,tbody,th,td,tr{display:block}
  thead{display:none}
  tbody tr{border:1px solid var(--line);border-radius:var(--radius);margin-bottom:.7rem;background:#fff;padding:.5rem .2rem}
  td{border:0;padding:.3rem 1rem;display:flex;justify-content:space-between;gap:1rem}
  td:before{content:attr(data-l);color:var(--muted);font-size:.74rem;text-transform:uppercase;letter-spacing:.05em}
}
</style>
</head>
<body>
<div id="app"></div>
<script>
(function(){
  "use strict";
  var app = document.getElementById("app");
  var CFG = null, USER = null;

  /* --------------------------------------------------------------- utils */
  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
  function label(list, value){
    if(!list) return value;
    for(var i=0;i<list.length;i++) if(list[i].value===value) return list[i].label;
    return value || "\\u2014";
  }
  function labels(list, values){
    if(!values || !values.length) return [];
    return values.map(function(v){ return label(list, v); });
  }
  function fmtDate(iso){
    if(!iso) return "\\u2014";
    var d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
    if(isNaN(d)) return iso;
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
  }
  function fmtWhen(iso){
    if(!iso) return "";
    var d = new Date(iso);
    if(isNaN(d)) return iso;
    return d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) +
           " \\u2014 " + d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
  }
  function money(v, cur){
    if(v == null || v === "") return "\\u2014";
    try { return new Intl.NumberFormat(undefined,{style:"currency",currency:cur||"EUR"}).format(v); }
    catch(e){ return (cur||"EUR") + " " + v; }
  }

  function api(path, opts){
    opts = opts || {};
    opts.credentials = "same-origin";
    opts.headers = opts.headers || {};
    if(opts.body && typeof opts.body !== "string"){
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch("/api/admin/" + path, opts).then(function(r){
      // A 401 from the login route means "wrong details" and belongs on the
      // login form. A 401 from anywhere else means the session has gone.
      if(r.status === 401 && path !== "login"){
        USER = null; renderLogin("Your session has ended. Please sign in again."); throw new Error("unauthorised");
      }
      return r.json().catch(function(){ return {}; }).then(function(d){
        if(!r.ok) throw new Error(d.error || ("HTTP " + r.status));
        return d;
      });
    });
  }

  /* --------------------------------------------------------------- login */
  function renderLogin(message){
    app.innerHTML =
      '<div class="login-wrap"><form class="login" id="lf">' +
        '<h1>Yeshua Royal Catering</h1><p class="sub">Admin</p>' +
        (message ? '<div class="alert">' + esc(message) + '</div>' : '') +
        '<div id="le"></div>' +
        '<div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" autofocus required></div>' +
        '<button class="btn btn-primary" style="width:100%" id="lb">Sign In</button>' +
      '</form></div>';

    document.getElementById("lf").addEventListener("submit", function(e){
      e.preventDefault();
      var btn = document.getElementById("lb");
      btn.disabled = true; btn.textContent = "Signing in\\u2026";
      api("login", { method:"POST", body:{ password:document.getElementById("pw").value } })
        .then(function(){ return boot(); })
        .catch(function(err){
          document.getElementById("le").innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
          btn.disabled = false; btn.textContent = "Sign In";
        });
    });
  }

  /* --------------------------------------------------------------- shell */
  function shell(active, inner){
    var nav = [["dashboard","Dashboard"],["enquiries","Enquiries"],["archived","Archived"],["settings","Settings"]];
    var links = nav.map(function(n){
      return '<a href="#/' + n[0] + '" class="' + (active === n[0] ? "on" : "") + '">' + n[1] + '</a>';
    }).join("");
    app.innerHTML =
      '<div class="shell"><nav class="side">' +
        '<div><div class="brand">Yeshua Royal</div><div class="brandsub">Admin</div></div>' +
        links + '<div class="spacer"></div>' +
        '<a href="#" id="out">Log out</a>' +
        '<div class="who">Signed in</div>' +
      '</nav><main class="main">' + inner + '</main></div>';

    document.getElementById("out").addEventListener("click", function(e){
      e.preventDefault();
      api("logout", { method:"POST" }).then(function(){ USER = null; renderLogin("You have been signed out."); });
    });
  }

  function statusBadge(s){ return '<span class="badge s-' + esc(s) + '">' + esc(label(CFG.statuses, s)) + '</span>'; }
  function priorityBadge(p){
    if(p === "normal" || !p) return "";
    return '<span class="badge p-' + esc(p) + '">' + esc(label(CFG.priorities, p)) + '</span>';
  }

  /* ----------------------------------------------------------- dashboard */
  function viewDashboard(){
    api("dashboard").then(function(d){
      var cards = CFG.statuses.map(function(s){
        return '<div class="stat"><div class="n">' + (d.byStatus[s.value] || 0) + '</div><div class="l">' + esc(s.label) + '</div></div>';
      }).join("");
      var totals =
        '<div class="stat"><div class="n">' + d.totals.active + '</div><div class="l">Active</div></div>' +
        '<div class="stat"><div class="n">' + d.totals.upcoming + '</div><div class="l">Upcoming events</div></div>' +
        '<div class="stat"><div class="n">' + d.totals.total + '</div><div class="l">Total enquiries</div></div>';

      shell("dashboard",
        '<div class="page-head"><h2>Dashboard</h2></div>' +
        '<div class="stats">' + totals + cards + '</div>' +
        '<div class="card"><h3>Recent enquiries</h3>' + tableOf(d.recent, true) + '</div>');
      wireRows();
    }).catch(showError);
  }

  function tableOf(rows, compact){
    if(!rows.length) return '<div class="body muted">Nothing here yet.</div>';
    var head = '<tr><th>Reference</th><th>Customer</th><th>Event</th><th>Event date</th><th>Location</th><th>Guests</th>' +
               (compact ? "" : "<th>Budget</th>") + '<th>Status</th><th>Received</th></tr>';
    var body = rows.map(function(r){
      var loc = r.venue_city || r.city || "\\u2014";
      return '<tr data-id="' + esc(r.id) + '">' +
        '<td data-l="Reference"><span class="ref">' + esc(r.reference) + '</span></td>' +
        '<td data-l="Customer">' + esc(r.full_name) + " " + priorityBadge(r.priority) + '</td>' +
        '<td data-l="Event">' + esc(label(CFG.eventTypes, r.event_type)) + '</td>' +
        '<td data-l="Event date">' + esc(fmtDate(r.event_date)) + '</td>' +
        '<td data-l="Location">' + esc(loc) + '</td>' +
        '<td data-l="Guests">' + esc(r.guest_count) + '</td>' +
        (compact ? "" : '<td data-l="Budget">' + esc(label(CFG.budgets, r.approximate_budget)) + '</td>') +
        '<td data-l="Status">' + statusBadge(r.status) + '</td>' +
        '<td data-l="Received">' + esc(fmtDate(r.created_at)) + '</td>' +
      '</tr>';
    }).join("");
    return '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function wireRows(){
    Array.prototype.forEach.call(document.querySelectorAll("tbody tr[data-id]"), function(tr){
      tr.addEventListener("click", function(){ location.hash = "#/enquiry/" + tr.getAttribute("data-id"); });
    });
  }

  /* ------------------------------------------------------------- listing */
  var filters = { q:"", status:"", event_type:"", budget:"", priority:"", city:"", sort:"newest", min_guests:"", event_from:"", event_to:"" };

  function viewList(archived){
    var qs = ["archived=" + (archived ? 1 : 0)];
    Object.keys(filters).forEach(function(k){ if(filters[k]) qs.push(k + "=" + encodeURIComponent(filters[k])); });

    api("enquiries?" + qs.join("&")).then(function(d){
      var sel = function(id, list, cur, blank){
        return '<select id="' + id + '"><option value="">' + blank + '</option>' +
          list.map(function(o){ return '<option value="' + esc(o.value) + '"' + (cur === o.value ? " selected" : "") + '>' + esc(o.label) + '</option>'; }).join("") +
        '</select>';
      };
      var sorts = [["newest","Newest first"],["oldest","Oldest first"],["event_soon","Event date soonest"],["largest","Largest event"],["smallest","Smallest event"]];

      shell(archived ? "archived" : "enquiries",
        '<div class="page-head"><h2>' + (archived ? "Archived" : "Enquiries") + '</h2>' +
          '<span class="muted">' + d.total + ' total</span></div>' +
        '<div class="filters">' +
          '<div><label for="f-q">Search</label><input id="f-q" placeholder="Name, email, phone, reference\\u2026" value="' + esc(filters.q) + '"></div>' +
          '<div><label for="f-status">Status</label>' + sel("f-status", CFG.statuses, filters.status, "Any status") + '</div>' +
          '<div><label for="f-type">Event type</label>' + sel("f-type", CFG.eventTypes, filters.event_type, "Any type") + '</div>' +
          '<div><label for="f-budget">Budget</label>' + sel("f-budget", CFG.budgets, filters.budget, "Any budget") + '</div>' +
          '<div><label for="f-priority">Priority</label>' + sel("f-priority", CFG.priorities, filters.priority, "Any priority") + '</div>' +
          '<div><label for="f-city">City</label><input id="f-city" value="' + esc(filters.city) + '"></div>' +
          '<div><label for="f-from">Event from</label><input id="f-from" type="date" value="' + esc(filters.event_from) + '"></div>' +
          '<div><label for="f-to">Event to</label><input id="f-to" type="date" value="' + esc(filters.event_to) + '"></div>' +
          '<div><label for="f-guests">Min guests</label><input id="f-guests" type="number" min="1" value="' + esc(filters.min_guests) + '"></div>' +
          '<div><label for="f-sort">Sort</label><select id="f-sort">' +
            sorts.map(function(s){ return '<option value="' + s[0] + '"' + (filters.sort === s[0] ? " selected" : "") + '>' + s[1] + '</option>'; }).join("") +
          '</select></div>' +
        '</div>' +
        '<div class="card">' + tableOf(d.rows, false) + '</div>');

      wireRows();
      var map = { "f-q":"q", "f-status":"status", "f-type":"event_type", "f-budget":"budget",
                  "f-priority":"priority", "f-city":"city", "f-from":"event_from", "f-to":"event_to",
                  "f-guests":"min_guests", "f-sort":"sort" };
      Object.keys(map).forEach(function(id){
        var el = document.getElementById(id);
        var ev = (el.tagName === "SELECT" || el.type === "date") ? "change" : "input";
        var timer;
        el.addEventListener(ev, function(){
          clearTimeout(timer);
          timer = setTimeout(function(){ filters[map[id]] = el.value; viewList(archived); }, ev === "input" ? 280 : 0);
        });
      });
    }).catch(showError);
  }

  /* -------------------------------------------------------------- detail */
  function viewEnquiry(id){
    api("enquiries/" + id).then(function(d){
      var e = d.enquiry;
      var dietary = labels(CFG.dietaryRequirements, e.dietary_requirements);
      var hasAllergy = e.dietary_requirements.some(function(x){ return x !== "none"; });

      function kv(pairs){
        return '<dl class="kv">' + pairs.filter(Boolean).map(function(p){
          return '<dt>' + esc(p[0]) + '</dt><dd>' + (p[2] ? p[1] : esc(p[1] == null || p[1] === "" ? "\\u2014" : p[1])) + '</dd>';
        }).join("") + '</dl>';
      }
      function chips(list){ return list.length ? '<div class="chips">' + list.map(function(l){ return '<span class="chip">' + esc(l) + '</span>'; }).join("") + '</div>' : "\\u2014"; }

      var contactActions =
        '<a class="btn btn-sm" href="tel:' + esc(e.phone) + '">Call</a> ' +
        '<a class="btn btn-sm" href="mailto:' + esc(e.email) + '">Email</a> ' +
        '<a class="btn btn-sm" href="https://wa.me/' + esc(String(e.phone).replace(/[^0-9]/g,"")) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>';

      var left =
        '<div class="card"><h3>Customer</h3><div class="body">' +
          kv([["Name", e.full_name],["Phone", e.phone],["Email", e.email],
              ["Preferred contact", label(CFG.preferredContact, e.preferred_contact)],
              ["Address", [e.address_line, e.city, e.region, e.postcode, CFG.countryLabel].filter(Boolean).join(", ")],
              ["Actions", contactActions, true]]) +
        '</div></div>' +

        (hasAllergy ?
          '<div class="card"><div class="body allergy"><h4>Dietary requirements &amp; allergies</h4>' +
            chips(dietary) +
            (e.dietary_details ? '<p style="margin:.7rem 0 0">' + esc(e.dietary_details) + '</p>' : "") +
            (e.affected_guest_count != null ? '<p class="muted" style="margin:.4rem 0 0">Guests affected: ' + esc(e.affected_guest_count) + '</p>' : "") +
          '</div></div>'
          : '<div class="card"><h3>Dietary requirements</h3><div class="body muted">None declared.</div></div>') +

        '<div class="card"><h3>Event</h3><div class="body">' +
          kv([["Event type", label(CFG.eventTypes, e.event_type) + (e.event_type_other ? " \\u2014 " + e.event_type_other : "")],
              ["Date", fmtDate(e.event_date)],
              ["Times", [e.start_time, e.end_time].filter(Boolean).join(" \\u2013 ")],
              ["Guests", e.guest_count + (e.child_guest_count ? " (" + e.child_guest_count + " children)" : "")],
              ["Venue status", label(CFG.venueStatuses, e.venue_status)],
              ["Venue", e.venue_name],
              ["Venue address", [e.venue_address, e.venue_city, e.venue_region, e.venue_postcode].filter(Boolean).join(", ")]]) +
        '</div></div>' +

        '<div class="card"><h3>Catering</h3><div class="body">' +
          kv([["Services", chips(labels(CFG.cateringServices, e.catering_services)), true],
              ["Other service", e.catering_services_other],
              ["Meal parts", chips(labels(CFG.mealRequirements, e.meal_requirements)), true],
              ["Food style", label(CFG.foodStyles, e.food_style) + (e.food_style_other ? " \\u2014 " + e.food_style_other : "")],
              ["Menu in mind", label(CFG.menuAnswers, e.existing_menu)],
              ["Menu request", e.menu_description]]) +
        '</div></div>' +

        '<div class="card"><h3>Event style</h3><div class="body">' +
          kv([["Style", chips(labels(CFG.eventStyles, e.event_style)), true],
              ["Theme / colours", e.theme_colours]]) +
        '</div></div>' +

        '<div class="card"><h3>Budget &amp; source</h3><div class="body">' +
          kv([["Approximate budget", label(CFG.budgets, e.approximate_budget)],
              ["Heard about us via", label(CFG.referralSources, e.referral_source)]]) +
        '</div></div>' +

        (e.additional_information ?
          '<div class="card"><h3>Customer notes</h3><div class="body">' + esc(e.additional_information) + '</div></div>' : "") +

        '<div class="card"><h3>Attachments</h3><div class="body files">' +
          (d.files.length ? d.files.map(function(f){
            return '<a href="/api/admin/files/' + esc(f.id) + '" target="_blank" rel="noopener">' +
              '<span>' + esc(f.filename) + '</span><span class="muted">' + Math.round(f.size_bytes/1024) + ' KB</span></a>';
          }).join("") : '<span class="muted">No attachments.</span>') +
        '</div></div>';

      var right =
        '<div class="card"><h3>Manage</h3><div class="body">' +
          '<div class="row">' +
            '<div><label for="d-status">Status</label><select id="d-status">' +
              CFG.statuses.map(function(s){ return '<option value="' + s.value + '"' + (e.status === s.value ? " selected" : "") + '>' + esc(s.label) + '</option>'; }).join("") +
            '</select></div>' +
            '<div><label for="d-priority">Priority</label><select id="d-priority">' +
              CFG.priorities.map(function(s){ return '<option value="' + s.value + '"' + (e.priority === s.value ? " selected" : "") + '>' + esc(s.label) + '</option>'; }).join("") +
            '</select></div>' +
          '</div>' +
          '<div class="row" style="margin-top:.7rem">' +
            '<div><label for="d-guests">Guest count</label><input id="d-guests" type="number" min="1" value="' + esc(e.guest_count) + '"></div>' +
            '<div><label for="d-date">Event date</label><input id="d-date" type="date" value="' + esc(e.event_date) + '"></div>' +
          '</div>' +
          '<div style="margin-top:.9rem"><button class="btn btn-primary btn-sm" id="d-save">Save changes</button> ' +
            '<button class="btn btn-sm" id="d-archive">' + (e.archived ? "Restore" : "Archive") + '</button> ' +
            '<span id="d-saved" class="saved"></span></div>' +
          '<div class="danger-zone">' +
            '<p>Archiving hides an enquiry but keeps it. Deleting removes it, its notes, its history and its files for good — use it when someone asks for their information to be erased.</p>' +
            '<button class="btn btn-sm btn-danger" id="d-delete">Delete permanently</button>' +
          '</div>' +
        '</div></div>' +

        '<div class="card"><h3>Quote</h3><div class="body">' +
          '<div class="row">' +
            '<div><label for="q-amt">Amount</label><input id="q-amt" type="number" step="0.01" min="0" value="' + esc(e.quoted_amount == null ? "" : e.quoted_amount) + '"></div>' +
            '<div><label for="q-cur">Currency</label><select id="q-cur">' +
              CFG.currency.options.map(function(c){ return '<option' + (e.quote_currency === c ? " selected" : "") + '>' + c + '</option>'; }).join("") +
            '</select></div>' +
          '</div>' +
          '<div class="row" style="margin-top:.7rem">' +
            '<div><label for="q-dep">Deposit</label><input id="q-dep" type="number" step="0.01" min="0" value="' + esc(e.deposit_amount == null ? "" : e.deposit_amount) + '"></div>' +
            '<div><label for="q-pct">Deposit %</label><input id="q-pct" type="number" step="1" min="0" max="100" value="' + esc(e.deposit_percent == null ? "" : e.deposit_percent) + '"></div>' +
            '<div><label for="q-exp">Valid until</label><input id="q-exp" type="date" value="' + esc(e.quote_expiry || "") + '"></div>' +
          '</div>' +
          '<div style="margin-top:.7rem"><label for="q-notes">Quote notes</label>' +
            '<textarea id="q-notes" rows="3" placeholder="Includes staff and transport; cake not included\\u2026">' + esc(e.quote_notes || "") + '</textarea></div>' +
          '<div style="margin-top:.7rem"><button class="btn btn-gold btn-sm" id="q-save">Save quote</button> <span id="q-saved" class="saved"></span></div>' +
          '<p class="muted" style="font-size:.78rem;margin:.8rem 0 0">Saved for your records. Sending it to the customer is not built yet.</p>' +
        '</div></div>' +

        '<div class="card"><h3>Internal notes</h3><div class="body">' +
          '<p class="muted" style="font-size:.78rem;margin:0 0 .6rem">Only ever visible here \\u2014 never to the customer.</p>' +
          '<div id="n-list">' + d.notes.map(noteHtml).join("") + '</div>' +
          '<textarea id="n-body" rows="3" placeholder="Spoke with customer by phone\\u2026"></textarea>' +
          '<div style="margin-top:.5rem"><button class="btn btn-sm" id="n-add">Add note</button></div>' +
        '</div></div>' +

        '<div class="card"><h3>Activity</h3><div class="body"><ul class="timeline" id="a-list">' +
          d.activity.map(activityHtml).join("") +
        '</ul></div></div>';

      shell(e.archived ? "archived" : "enquiries",
        '<div class="page-head"><div>' +
          '<h2>' + esc(e.full_name) + '</h2>' +
          '<span class="ref">' + esc(e.reference) + '</span> ' + statusBadge(e.status) + ' ' + priorityBadge(e.priority) +
          (e.archived ? ' <span class="badge s-declined">Archived</span>' : '') +
        '</div><a class="btn btn-sm" href="#/enquiries">Back to list</a></div>' +
        (e.quoted_amount != null ? '<div class="notice">Quote recorded: <strong>' + esc(money(e.quoted_amount, e.quote_currency)) + '</strong>' +
          (e.quote_expiry ? ' \\u00b7 valid until ' + esc(fmtDate(e.quote_expiry)) : "") + '</div><div style="height:1rem"></div>' : "") +
        '<div class="grid2"><div>' + left + '</div><div>' + right + '</div></div>');

      wireDetail(id, e);
    }).catch(showError);
  }

  function noteHtml(n){
    return '<div class="note">' + esc(n.body) + '<div class="meta">' + esc(n.author || "admin") + " \\u00b7 " + esc(fmtWhen(n.created_at)) + '</div></div>';
  }
  function activityHtml(a){
    return '<li><strong>' + esc(fmtWhen(a.created_at)) + '</strong><br>' + esc(a.detail || a.kind) +
           (a.actor ? ' <span class="muted">\\u00b7 ' + esc(a.actor) + '</span>' : "") + '</li>';
  }

  function wireDetail(id, e){
    function patch(body, flagId, btnId){
      var btn = document.getElementById(btnId);
      var flag = document.getElementById(flagId);
      btn.disabled = true;
      api("enquiries/" + id, { method:"PATCH", body:body })
        .then(function(){ flag.textContent = "Saved"; setTimeout(function(){ viewEnquiry(id); }, 500); })
        .catch(function(err){ flag.textContent = ""; alert(err.message); })
        .then(function(){ btn.disabled = false; });
    }

    document.getElementById("d-save").addEventListener("click", function(){
      patch({
        status: document.getElementById("d-status").value,
        priority: document.getElementById("d-priority").value,
        guest_count: document.getElementById("d-guests").value,
        event_date: document.getElementById("d-date").value
      }, "d-saved", "d-save");
    });

    document.getElementById("d-archive").addEventListener("click", function(){
      var next = e.archived ? 0 : 1;
      if(!next || confirm("Archive this enquiry? It stays in the database and can be restored.")){
        patch({ archived: next }, "d-saved", "d-archive");
      }
    });

    document.getElementById("q-save").addEventListener("click", function(){
      patch({
        quoted_amount: document.getElementById("q-amt").value,
        quote_currency: document.getElementById("q-cur").value,
        deposit_amount: document.getElementById("q-dep").value,
        deposit_percent: document.getElementById("q-pct").value,
        quote_expiry: document.getElementById("q-exp").value,
        quote_notes: document.getElementById("q-notes").value
      }, "q-saved", "q-save");
    });

    document.getElementById("d-delete").addEventListener("click", function(){
      var BREAK = String.fromCharCode(10) + String.fromCharCode(10);
      var typed = prompt(
        "This permanently deletes enquiry " + e.reference + ", including its notes, " +
        "history and any attached files. It cannot be undone." + BREAK +
        "Type the reference to confirm:"
      );
      if(typed === null) return;                       // cancelled
      var btn = document.getElementById("d-delete");
      btn.disabled = true;
      api("enquiries/" + id, { method:"DELETE", body:{ confirm: typed } })
        .then(function(res){
          alert("Enquiry " + res.reference + " deleted" +
                (res.filesRemoved ? " along with " + res.filesRemoved + " file(s)." : "."));
          location.hash = "#/enquiries";
        })
        .catch(function(err){ alert(err.message); btn.disabled = false; });
    });

    document.getElementById("n-add").addEventListener("click", function(){
      var body = document.getElementById("n-body").value.trim();
      if(!body) return;
      var btn = document.getElementById("n-add");
      btn.disabled = true;
      api("enquiries/" + id + "/notes", { method:"POST", body:{ body:body } })
        .then(function(){ viewEnquiry(id); })
        .catch(function(err){ alert(err.message); btn.disabled = false; });
    });
  }

  /* ------------------------------------------------------------ settings */
  function viewSettings(){
    function list(title, items){
      return '<div class="card"><h3>' + esc(title) + '</h3><div class="body"><div class="chips">' +
        items.map(function(o){
          return '<span class="chip"' + (o.enabled ? "" : ' style="opacity:.45;text-decoration:line-through"') + '>' + esc(o.label) + '</span>';
        }).join("") + '</div></div></div>';
    }
    shell("settings",
      '<div class="page-head"><h2>Settings</h2></div>' +
      '<div class="notice">These lists are the single source of truth for the public form and this dashboard. ' +
      'To add, rename, reorder or switch one off, edit <strong>worker/src/lib/config.js</strong> and redeploy the Worker. ' +
      'Options switched off disappear from the form but keep displaying correctly on enquiries that already use them.</div>' +
      '<div style="height:1rem"></div>' +
      list("Catering services", CFG.cateringServices) +
      list("Dietary requirements", CFG.dietaryRequirements) +
      list("Event types", CFG.eventTypes) +
      list("Budget ranges", CFG.budgets) +
      '<div class="card"><h3>Currency</h3><div class="body">Quotes are recorded in ' +
        esc(CFG.currency.options.join(", ")) + '.</div></div>' +
      list("Statuses", CFG.statuses) +
      '<div class="card"><h3>Sign-in</h3><div class="body">Password only. Change it with ' +
        '<strong>npm run admin:password</strong> in the worker folder. ' +
        'Eight wrong attempts locks sign-in for 15 minutes.</div></div>');
  }

  function showError(err){
    if(err && err.message === "unauthorised") return;
    app.innerHTML = '<div class="main"><div class="alert">' + esc(err.message || "Something went wrong.") + '</div>' +
                    '<a class="btn" href="#/dashboard">Back to dashboard</a></div>';
  }

  /* -------------------------------------------------------------- router */
  function router(){
    if(!USER) return;
    var h = location.hash.replace(/^#\\//, "") || "dashboard";
    if(h.indexOf("enquiry/") === 0) return viewEnquiry(h.slice(8));
    if(h === "enquiries") return viewList(false);
    if(h === "archived") return viewList(true);
    if(h === "settings") return viewSettings();
    return viewDashboard();
  }
  window.addEventListener("hashchange", router);

  function boot(){
    return api("me").then(function(d){
      USER = d.user; CFG = d.config;
      router();
    }).catch(function(){ renderLogin(); });
  }
  boot();
})();
</script>
</body>
</html>`;
}
