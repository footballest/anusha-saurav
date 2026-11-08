// Renders every section of the invitation from the loaded data,
// plus the opening doors animation, lamps, mini-nav and scroll reveal.
(function () {
  "use strict";

  var VARIANT = window.VARIANT === "reception" ? "reception" : "full";
  var ROOT = window.ROOT || "./";
  var IMG = ROOT + "assets/img/";
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var countdownTimer = null;

  // Which illustration goes with which venue (by event id).
  var VIGNETTES = { wedding: "venue-staydium.svg", reception: "venue-khills.svg" };

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function asset(path) { return /^https?:\/\//.test(path) ? path : ROOT + path; }
  function phonePretty(e164) {
    var m = /^\+91(\d{5})(\d{5})$/.exec(e164);
    return m ? "+91 " + m[1] + " " + m[2] : e164;
  }
  function eventsForVariant(events) {
    return events.filter(function (e) {
      return String(e.variants).split(",").map(function (v) { return v.trim(); }).indexOf(VARIANT) !== -1;
    });
  }
  function guestName() {
    var to = new URLSearchParams(location.search).get("to");
    to = to ? to.trim().slice(0, 40) : "";
    return to || "guest";
  }
  function deco(file, cls, lazy) {
    return '<img class="' + cls + '" src="' + IMG + file + '" alt="" aria-hidden="true"' +
      (lazy ? ' loading="lazy"' : "") + ' decoding="async">';
  }
  // Couple illustrations come only from the `images` block in the data, so they can be
  // swapped (SVG or transparent PNG/WebP, any aspect ratio) by changing one path.
  function coupleImg(src, cls, alt, lazy) {
    if (!src) return "";
    return '<img class="couple ' + cls + '" src="' + esc(asset(src)) + '" alt="' + esc(alt) +
      '"' + (lazy ? ' loading="lazy"' : "") + ' decoding="async" onerror="this.hidden=true">';
  }
  function title(id, text) {
    return '<h2 id="' + id + '" class="section-title">' + text + "</h2>";
  }

  // Small line icons (inherit text colour).
  var ICON = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.4-4A8 8 0 1 1 8.5 19z"/><path d="M9 9.5c.5 2 2.5 4 5 5l1.2-1.2"/></svg>'
  };

  var NAVICON = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>'
  };

  // ---------- inline SVG loader (so lamp flames can be animated) ----------
  var svgCache = {}, svgUid = 0;
  function inlineSvg(el, file) {
    var url = IMG + file;
    svgCache[url] = svgCache[url] || fetch(url).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; });
    return svgCache[url].then(function (txt) {
      if (!txt) return el;
      var n = ++svgUid; // make ids unique per copy
      el.innerHTML = txt
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/ role="img"| aria-label="[^"]*"/g, "")
        .replace(/id="([^"]+)"/g, 'id="$1-' + n + '"')
        .replace(/url\(#([^)]+)\)/g, "url(#$1-" + n + ")")
        .replace(/href="#([^"]+)"/g, 'href="#$1-' + n + '"');
      return el;
    });
  }
  function lampHtml(cls) { return '<span class="lamp ' + cls + '" aria-hidden="true"></span>'; }
  function loadLamps(scope, lit) {
    var lamps = scope.querySelectorAll(".lamp:not(.loaded)");
    return Promise.all([].map.call(lamps, function (el) {
      el.classList.add("loaded");
      return inlineSvg(el, "nilavilakku.svg").then(function () {
        if (lit) lightLamp(el, 0, true);
        return el;
      });
    }));
  }
  // Light the wicks one by one. Returns ms until the last wick is lit.
  function lightLamp(el, delay, instant) {
    var flames = el.querySelectorAll(".flame");
    var order = [0, 2, 3, 4, 1]; // back-left, front-left, centre, front-right, back-right
    var timers = [];
    timers.push(setTimeout(function () { el.classList.add("is-lit"); }, delay));
    order.forEach(function (idx, i) {
      if (!flames[idx]) return;
      if (instant) { flames[idx].classList.add("on"); return; }
      timers.push(setTimeout(function () { flames[idx].classList.add("on"); }, delay + i * 110));
    });
    return timers;
  }

  // ---------- sections ----------
  function head(id, label, text) {
    return '<header class="section-head">' + (label ? '<p class="label">' + label + "</p>" : "") +
      '<h2 id="' + id + '" class="section-title">' + text + "</h2></header>";
  }
  function splitDot(s) { var i = String(s).lastIndexOf(" · "); return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 3)]; }

  function frame() {
    return '<div class="frame" aria-hidden="true">' +
      '<svg class="frame-top" viewBox="0 0 100 40" preserveAspectRatio="none">' +
        '<path d="M0 40 L0 32 L50 0 L100 32 L100 40" stroke-width="1"/>' +
        '<path d="M4 40 L4 34.5 L50 5 L96 34.5 L96 40" stroke-width="1" opacity=".55"/>' +
      "</svg><div class=\"frame-sides\"></div></div>";
  }

  function hero(d) {
    var s = d.settings;
    var dl = splitDot(VARIANT === "full" ? s.hero_date_full : s.hero_date_reception);
    var intro = VARIANT === "reception"
      ? '<p class="greeting">' + esc(String(s.reception_greeting).replace("{name}", guestName())) + "</p>"
      : '<p class="label">Together with their families</p><p class="lead">joyfully invite you to celebrate</p>';
    return '<section class="hero" id="top">' +
      '<img class="ganapathi" src="' + IMG + 'ganapathi.svg" alt="Ganapathi" width="46" height="47">' +
      '<p class="invocation" lang="ml">' + esc(s.invocation) + "</p>" +
      intro +
      '<div class="hero-stage">' +
        lampHtml("lamp-hero lamp-l") +
        coupleImg(d.images.hero, "couple-hero", "Illustration of Anusha and Saurav") +
        lampHtml("lamp-hero lamp-r") +
      "</div>" +
      '<h1 class="names"><span class="n">Anusha</span><span class="amp">&amp;</span><span class="n">Saurav</span></h1>' +
      '<span class="rule" aria-hidden="true"></span>' +
      '<p class="date-line">' + esc(dl[0]) + "</p>" +
      (dl[1] ? '<p class="place">' + esc(dl[1]) + "</p>" : "") +
      "</section>";
  }

  function family(childName, relation, parents, house, showAddr) {
    return '<div class="family reveal">' +
      '<p class="family-child">' + esc(childName) + "</p>" +
      '<p class="family-rel">' + esc(relation) + "</p>" +
      '<p class="family-parents">' + esc(parents).replace(" &amp; ", " &amp;<br>") + "</p>" +
      (showAddr && house ? '<p class="family-house">' + esc(house) + "</p>" : "") +
      "</div>";
  }

  function invitation(d) {
    var s = d.settings, f = d.families;
    var intro = VARIANT === "full" ? s.full_intro : s.reception_intro;
    return '<section class="section invitation" id="invitation" aria-labelledby="h-invite">' +
      head("h-invite", "With the blessings of our elders", "With joy, we invite you") +
      '<p class="intro reveal">' + rich(intro) + "</p>" +
      family(s.bride_name, "daughter of", f.bride_parents, f.bride_house, s.show_addresses) +
      '<p class="weds" aria-hidden="true">&amp;</p>' +
      family(s.groom_name, "son of", f.groom_parents, f.groom_house, s.show_addresses) +
      "</section>";
  }

  function countdown() {
    var units = [["days", "Days"], ["hours", "Hours"], ["mins", "Mins"], ["secs", "Secs"]];
    return '<section class="section countdown" id="countdown" aria-labelledby="h-count">' +
      head("h-count", "Counting down to", VARIANT === "full" ? "the Muhurtham" : "the Reception") +
      '<div class="cd-grid reveal" role="timer" aria-live="off">' +
      units.map(function (u) {
        return '<div class="cd-card"><span class="cd-num" data-unit="' + u[0] + '">–</span>' +
          '<span class="cd-label">' + u[1] + "</span></div>";
      }).join("") +
      "</div></section>";
  }

  function eventCard(e, d) {
    var cal = window.Calendar;
    return '<article class="event-card reveal" id="event-' + esc(e.id) + '">' +
      '<p class="event-ml" lang="ml">' + esc(e.name_ml) + "</p>" +
      '<h3 class="event-name">' + esc(e.name_en) + "</h3>" +
      '<p class="event-date">' + esc(e.date_label) + "</p>" +
      '<p class="event-time">' + esc(e.time_label) + "</p>" +
      '<p class="event-venue">' + esc(e.venue) + "</p>" +
      '<div class="btn-row">' +
      '<a class="btn" href="' + esc(e.maps_url) + '" target="_blank" rel="noopener">' + ICON.pin + "Directions</a>" +
      (cal ? '<button type="button" class="btn" data-cal-toggle aria-expanded="false" aria-controls="cal-' + esc(e.id) + '">' +
        NAVICON.cal + "Add to calendar</button>" : "") +
      "</div>" +
      (cal ? cal.menuHtml(e, d) : "") +
      "</article>";
  }

  function events(list, d) {
    return '<section class="section events" id="events" aria-labelledby="h-events">' +
      head("h-events", list.length > 1 ? "Save the dates" : "Save the date", list.length > 1 ? "The Celebrations" : "The Celebration") +
      list.map(function (e) { return eventCard(e, d); }).join("") + "</section>";
  }

  function venues(list) {
    return '<section class="section venues" id="venue" aria-labelledby="h-venue">' +
      head("h-venue", "Finding your way", list.length > 1 ? "The Venues" : "The Venue") +
      list.map(function (e) {
        var art = VIGNETTES[e.id];
        return '<article class="venue-card reveal">' +
          (art ? deco(art, "venue-art", true) : "") +
          '<div class="venue-body">' +
          '<p class="label">' + esc(e.name_en) + "</p>" +
          '<h3 class="venue-name">' + esc(e.venue) + "</h3>" +
          '<p class="venue-addr">' + esc(e.address) + "</p>" +
          '<div class="btn-row"><a class="btn" href="' + esc(e.maps_url) + '" target="_blank" rel="noopener">' + ICON.pin + "Open in Google Maps</a></div>" +
          "</div></article>";
      }).join("") + "</section>";
  }

  function rsvpSection(d) {
    return '<section class="section rsvp" id="rsvp" aria-labelledby="h-rsvp">' +
      head("h-rsvp", "Kindly respond", "RSVP") +
      '<div id="rsvp-mount" class="reveal">' + (window.renderRsvp ? window.renderRsvp(d, VARIANT) : "") + "</div>" +
      "</section>";
  }

  function gallery(d) {
    if (!d.settings.gallery_enabled) return "";
    return '<section class="section gallery" id="gallery" aria-labelledby="h-gallery">' +
      head("h-gallery", "Moments", "Gallery") +
      '<div id="gallery-mount"></div></section>';
  }

  function contacts(list) {
    return '<section class="section contacts" id="contact" aria-labelledby="h-contact">' +
      head("h-contact", "For any help", "Contact") +
      '<ul class="contact-list">' +
      list.map(function (c) {
        var digits = String(c.phone_e164).replace(/\D/g, "");
        var wa = !(c.whatsapp === false || String(c.whatsapp).toUpperCase() === "FALSE");
        return '<li class="contact reveal">' +
          '<p class="contact-name">' + esc(c.name) + "</p>" +
          '<p class="contact-rel">' + esc(c.relation) + ' · <span class="nowrap">' + esc(phonePretty(c.phone_e164)) + "</span></p>" +
          '<div class="btn-row">' +
          '<a class="btn" href="tel:' + esc(c.phone_e164) + '" aria-label="Call ' + esc(c.name) + '">' + ICON.phone + "Call</a>" +
          (wa ? '<a class="btn" href="https://wa.me/' + digits + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + esc(c.name) + '">' + ICON.chat + "WhatsApp</a>" : "") +
          "</div></li>";
      }).join("") + "</ul></section>";
  }

  function closing(d) {
    return '<section class="section closing" id="see-you" aria-labelledby="h-closing">' +
      '<div class="reveal">' + coupleImg(d.images.back, "couple-back", "The bride and groom walking together, holding hands", true) + "</div>" +
      '<h2 id="h-closing" class="closing-title reveal">See you there!</h2>' +
      "</section>";
  }

  function footer(d) {
    var s = d.settings;
    var pdf = VARIANT === "full" ? d.files.pdf_full : d.files.pdf_reception;
    var qr = VARIANT === "full" ? d.files.qr_full : d.files.qr_reception;
    return '<footer class="site-footer">' +
      '<p class="label">Sharing the happiness</p>' +
      '<p class="sharing">' + esc(s.sharing_the_happiness) + "</p>" +
      '<p data-if-exists="' + esc(asset(pdf)) + '" hidden><a class="btn btn-primary" href="' + esc(asset(pdf)) + '" download>Download invitation (PDF)</a></p>' +
      '<p data-if-exists="' + esc(asset(qr)) + '" hidden><img class="qr" src="' + esc(asset(qr)) + '" alt="QR code for this invitation" width="140" height="140" loading="lazy"></p>' +
      '<div class="reveal">' + coupleImg(d.images.namaste, "couple-namaste", "Bride and groom with folded hands", true) + "</div>" +
      '<p class="footer-date">' + esc(s.footer_date) + "</p>" +
      "</footer>";
  }

  // ---------- theme ----------
  var THEMES = { green: "#1F3B2D", kasavu: "#FFFFFF", lotus: "#F2DFDB", maroon: "#5E1424" };
  function applyTheme(name) {
    if (!THEMES[name]) return;
    document.documentElement.setAttribute("data-theme", name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[name]);
  }
  // A small swatch picker, shown only when the URL contains ?themes — for choosing, not for guests.
  function setupThemePicker() {
    if (!/[?&]themes\b/.test(location.search) || document.querySelector(".theme-picker")) return;
    var box = document.createElement("div");
    box.className = "theme-picker";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Try a colour theme");
    box.innerHTML = Object.keys(THEMES).map(function (k) {
      return '<button type="button" data-theme="' + k + '" title="' + k + '" aria-label="' + k + ' theme" style="background:' + THEMES[k] + '"></button>';
    }).join("");
    function mark() {
      var cur = document.documentElement.getAttribute("data-theme");
      box.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.theme === cur)); });
    }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      applyTheme(b.dataset.theme);
      document.documentElement.setAttribute("data-theme-locked", "1");
      var u = new URL(location.href); u.searchParams.set("theme", b.dataset.theme); history.replaceState(null, "", u);
      mark();
    });
    document.body.appendChild(box);
    mark();
  }

  function garland() {
    if (document.querySelector(".garland")) return;
    var g = document.createElement("div");
    g.className = "garland";
    g.setAttribute("aria-hidden", "true");
    var n = window.innerWidth >= 768 ? 9 : 5;
    var html = "";
    for (var i = 0; i < n; i++) html += '<img src="' + IMG + 'jasmine.svg" alt="">';
    g.innerHTML = html;
    document.body.insertBefore(g, document.body.firstChild);
  }

  function revealIfExists() {
    document.querySelectorAll("[data-if-exists]").forEach(function (el) {
      fetch(el.getAttribute("data-if-exists"), { method: "HEAD" })
        .then(function (r) { if (r.ok) el.hidden = false; })
        .catch(function () {});
    });
  }

  // ---------- countdown ----------
  function startCountdown(d) {
    clearInterval(countdownTimer);
    var target = d.events.filter(function (e) { return e.id === (VARIANT === "full" ? "wedding" : "reception"); })[0];
    if (!target) return;
    var t = Date.parse(target.start_iso);
    var section = document.getElementById("countdown");
    function tick() {
      var diff = t - Date.now();
      if (diff <= 0) {
        clearInterval(countdownTimer);
        section.innerHTML = '<p class="thank-you">' + esc(d.settings.thank_you) + "</p>";
        return;
      }
      var secs = Math.floor(diff / 1000);
      var vals = { days: Math.floor(secs / 86400), hours: Math.floor(secs % 86400 / 3600), mins: Math.floor(secs % 3600 / 60), secs: secs % 60 };
      Object.keys(vals).forEach(function (k) {
        var el = section.querySelector('[data-unit="' + k + '"]');
        if (el) el.textContent = k === "days" ? vals[k] : String(vals[k]).padStart(2, "0");
      });
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ---------- scroll reveal ----------
  function setupReveal() {
    var els = document.querySelectorAll(".reveal:not(.in)");
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- sticky mini-nav ----------
  var navIO = null, spyIO = null;
  function setupMiniNav() {
    var nav = document.getElementById("mini-nav");
    if (!nav) {
      nav = document.createElement("nav");
      nav.id = "mini-nav";
      nav.className = "mini-nav";
      nav.setAttribute("aria-label", "Sections");
      document.body.appendChild(nav);
    }
    var links = [["events", "Events", NAVICON.cal], ["venue", "Venue", ICON.pin], ["rsvp", "RSVP", NAVICON.heart], ["contact", "Contact", ICON.phone]]
      .filter(function (l) { return document.getElementById(l[0]); });
    nav.innerHTML = '<ul>' + links.map(function (l) {
      return '<li><a href="#' + l[0] + '" data-target="' + l[0] + '">' + l[2] + "<span>" + l[1] + "</span></a></li>";
    }).join("") + "</ul>";

    if (navIO) navIO.disconnect();
    if (spyIO) spyIO.disconnect();
    if (!("IntersectionObserver" in window)) { nav.classList.add("show"); return; }

    var hero = document.getElementById("top");
    navIO = new IntersectionObserver(function (en) {
      nav.classList.toggle("show", !en[0].isIntersecting);
    }, { threshold: 0 });
    navIO.observe(hero);

    // Highlight the section currently in view.
    spyIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        nav.querySelectorAll("a").forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("data-target") === en.target.id);
          if (a.classList.contains("active")) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (l) { spyIO.observe(document.getElementById(l[0])); });
  }

  // ---------- opening screen ----------
  // The cover's markup is in the HTML page (so it paints before any script runs); the
  // inline script in <head> adds html.has-cover when it should be shown.
  function setupOpening() {
    var opening = document.getElementById("opening");
    if (!opening) return;
    var root = document.documentElement;
    if (!root.classList.contains("has-cover")) { opening.remove(); return; }
    loadLamps(opening, false);

    var btn = document.getElementById("open-invitation");
    var skip = document.getElementById("skip-opening");
    var timers = [], started = false, finished = false;
    btn.focus({ preventScroll: true });

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function finish() {
      if (finished) return;
      finished = true;
      timers.forEach(clearTimeout);
      try { sessionStorage.setItem("as-opened", "1"); } catch (e) {}
      opening.remove();
      root.classList.remove("has-cover");
      document.removeEventListener("keydown", onKey);
      document.getElementById("app").focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent("invitation:opened"));
    }
    function onKey(e) { if (e.key === "Escape" && started) finish(); }
    document.addEventListener("keydown", onKey);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (started) return;
      started = true;
      document.dispatchEvent(new CustomEvent("invitation:open-tap")); // music can unlock audio here (Phase 4)

      if (REDUCED) {
        opening.querySelectorAll(".lamp-open").forEach(function (l) { lightLamp(l, 0, true); });
        opening.classList.add("is-fading");
        later(finish, 400);
        return;
      }
      // Timeline (≈2.2 s): plaque fades → wicks light one by one → doors swing open → cover fades.
      skip.hidden = false;
      opening.classList.add("is-lighting");
      opening.querySelectorAll(".lamp-open").forEach(function (l) {
        timers = timers.concat(lightLamp(l, 250, false));
      });
      later(function () { opening.classList.add("is-opening"); }, 900);
      later(function () { opening.classList.add("is-fading"); }, 1750);
      later(finish, 2250);
    });
    skip.addEventListener("click", finish);
    opening.addEventListener("click", function () { if (started) finish(); });
  }

  // ---------- render ----------
  function render(d) {
    var list = eventsForVariant(d.events);
    var app = document.getElementById("app");
    if (!document.documentElement.hasAttribute("data-theme-locked")) applyTheme(d.settings.theme);
    app.innerHTML = frame() +
      hero(d) + invitation(d) + countdown() + events(list, d) + venues(list) +
      rsvpSection(d) + gallery(d) + contacts(d.contacts) + closing(d) + footer(d);
    garland();
    setupThemePicker();
    if (!document.querySelector(".page-end")) {
      var end = document.createElement("div"); end.className = "page-end"; end.setAttribute("aria-hidden", "true");
      app.parentNode.insertBefore(end, app.nextSibling);
    }
    // The cover's painting is in the HTML; follow the data if it names a different one.
    var oc = document.getElementById("opening-couple");
    if (oc && d.images.namaste) {
      var ocImg = oc.querySelector("img");
      if (!ocImg) oc.innerHTML = coupleImg(d.images.namaste, "couple-opening", "Bride and groom with folded hands");
      else if (ocImg.getAttribute("src") !== asset(d.images.namaste)) { ocImg.removeAttribute("width"); ocImg.removeAttribute("height"); ocImg.src = asset(d.images.namaste); }
    }
    loadLamps(app, true);
    startCountdown(d);
    revealIfExists();
    if (window.Calendar) window.Calendar.bind(app, list, d);
    if (window.Music) window.Music.init(d);
    if (window.Gallery) window.Gallery.init(d);
    if (window.initRsvp) window.initRsvp(d, VARIANT);
    setupReveal();
    setupMiniNav();
  }

  setupOpening();
  window.loadSiteData(render);
})();
