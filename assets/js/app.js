// Renders every section of the invitation from the loaded data.
(function () {
  "use strict";

  var VARIANT = window.VARIANT === "reception" ? "reception" : "full";
  var ROOT = window.ROOT || "./";
  var countdownTimer = null;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Escape, then allow **bold** only.
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
  function asset(path) {
    return /^https?:\/\//.test(path) ? path : ROOT + path;
  }
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
  function coupleImg(src, cls, alt) {
    // Hidden automatically if the file is missing (e.g. before Phase 3).
    return '<img class="' + cls + '" src="' + esc(asset(src)) + '" alt="' + esc(alt) +
      '" loading="lazy" decoding="async" onerror="this.hidden=true">';
  }

  // ---------- sections ----------
  function hero(d) {
    var s = d.settings;
    var greeting = VARIANT === "reception"
      ? '<p class="greeting">' + esc(String(s.reception_greeting).replace("{name}", guestName())) + "</p>"
      : "";
    return '<section class="hero" id="top">' +
      '<p class="invocation" lang="ml">' + esc(s.invocation) + "</p>" +
      greeting +
      coupleImg(d.images.hero, "couple-hero", "Illustration of the bride and groom") +
      '<h1 class="names"><span>Anusha</span> <span class="amp">&amp;</span> <span>Saurav</span></h1>' +
      '<p class="date-line">' + esc(VARIANT === "full" ? s.hero_date_full : s.hero_date_reception) + "</p>" +
      "</section>";
  }

  function family(childName, relation, parents, house, showAddr) {
    return '<div class="family">' +
      '<p class="family-child">' + esc(childName) + "</p>" +
      '<p class="family-rel">' + esc(relation) + "</p>" +
      '<p class="family-parents">' + esc(parents) + "</p>" +
      (showAddr && house ? '<p class="family-house">' + esc(house) + "</p>" : "") +
      "</div>";
  }

  function invitation(d) {
    var s = d.settings, f = d.families;
    var intro = VARIANT === "full" ? s.full_intro : s.reception_intro;
    return '<section class="section invitation" id="invitation" aria-labelledby="h-invite">' +
      '<h2 id="h-invite" class="section-title">With joy, we invite you</h2>' +
      '<p class="intro">' + rich(intro) + "</p>" +
      '<div class="families">' +
      family(s.bride_name, "daughter of", f.bride_parents, f.bride_house, s.show_addresses) +
      '<p class="weds" aria-hidden="true">❀</p>' +
      family(s.groom_name, "son of", f.groom_parents, f.groom_house, s.show_addresses) +
      "</div></section>";
  }

  function countdown() {
    var units = [["days", "Days"], ["hours", "Hours"], ["mins", "Mins"], ["secs", "Secs"]];
    return '<section class="section countdown" id="countdown" aria-labelledby="h-count">' +
      '<h2 id="h-count" class="section-title">Counting down to ' +
      (VARIANT === "full" ? "the muhurtham" : "the reception") + "</h2>" +
      '<div class="cd-grid" role="timer" aria-live="off">' +
      units.map(function (u) {
        return '<div class="cd-card"><span class="cd-num" data-unit="' + u[0] + '">–</span>' +
          '<span class="cd-label">' + u[1] + "</span></div>";
      }).join("") +
      "</div></section>";
  }

  function eventCard(e) {
    return '<article class="card event-card" id="event-' + esc(e.id) + '">' +
      '<p class="event-ml" lang="ml">' + esc(e.name_ml) + "</p>" +
      '<h3 class="event-name">' + esc(e.name_en) + "</h3>" +
      '<p class="event-date">' + esc(e.date_label) + "</p>" +
      '<p class="event-time">' + esc(e.time_label) + "</p>" +
      '<p class="event-venue">' + esc(e.venue) + "</p>" +
      '<div class="btn-row">' +
      '<a class="btn" href="' + esc(e.maps_url) + '" target="_blank" rel="noopener">Directions</a>' +
      // "Add to calendar" arrives in Phase 4 (calendar.js).
      "</div></article>";
  }

  function events(list) {
    return '<section class="section events" id="events" aria-labelledby="h-events">' +
      '<h2 id="h-events" class="section-title">' + (list.length > 1 ? "Events" : "The Celebration") + "</h2>" +
      list.map(eventCard).join("") + "</section>";
  }

  function venues(list) {
    return '<section class="section venues" id="venue" aria-labelledby="h-venue">' +
      '<h2 id="h-venue" class="section-title">' + (list.length > 1 ? "Venues" : "Venue") + "</h2>" +
      list.map(function (e) {
        return '<article class="card venue-card">' +
          '<div class="venue-art" aria-hidden="true"></div>' +
          '<h3 class="venue-name">' + esc(e.venue) + "</h3>" +
          '<p class="venue-for">' + esc(e.name_en) + "</p>" +
          '<p class="venue-addr">' + esc(e.address) + "</p>" +
          '<a class="btn" href="' + esc(e.maps_url) + '" target="_blank" rel="noopener">Open in Google Maps</a>' +
          "</article>";
      }).join("") + "</section>";
  }

  function rsvpSection(d) {
    return '<section class="section rsvp" id="rsvp" aria-labelledby="h-rsvp">' +
      '<h2 id="h-rsvp" class="section-title">RSVP</h2>' +
      '<div id="rsvp-mount">' + (window.renderRsvp ? window.renderRsvp(d, VARIANT) : "") + "</div>" +
      "</section>";
  }

  function gallery(d) {
    if (!d.settings.gallery_enabled) return "";
    return '<section class="section gallery" id="gallery" aria-labelledby="h-gallery">' +
      '<h2 id="h-gallery" class="section-title">Gallery</h2>' +
      '<p class="muted center">Photos coming soon.</p></section>';
  }

  function contacts(list) {
    return '<section class="section contacts" id="contact" aria-labelledby="h-contact">' +
      '<h2 id="h-contact" class="section-title">Contact</h2>' +
      '<ul class="contact-list">' +
      list.map(function (c) {
        var digits = String(c.phone_e164).replace(/\D/g, "");
        return '<li class="card contact">' +
          '<p class="contact-name">' + esc(c.name) + "</p>" +
          '<p class="contact-rel">' + esc(c.relation) + " · " + esc(phonePretty(c.phone_e164)) + "</p>" +
          '<div class="btn-row">' +
          '<a class="btn" href="tel:' + esc(c.phone_e164) + '" aria-label="Call ' + esc(c.name) + '">Call</a>' +
          (String(c.whatsapp) !== "false" && c.whatsapp !== false
            ? '<a class="btn" href="https://wa.me/' + digits + '" target="_blank" rel="noopener" aria-label="WhatsApp ' + esc(c.name) + '">WhatsApp</a>'
            : "") +
          "</div></li>";
      }).join("") + "</ul></section>";
  }

  function footer(d) {
    var s = d.settings;
    var pdf = VARIANT === "full" ? d.files.pdf_full : d.files.pdf_reception;
    var qr = VARIANT === "full" ? d.files.qr_full : d.files.qr_reception;
    return '<footer class="site-footer">' +
      '<p class="sharing-label">Sharing the happiness</p>' +
      '<p class="sharing">' + esc(s.sharing_the_happiness) + "</p>" +
      '<p data-if-exists="' + esc(asset(pdf)) + '" hidden><a class="btn btn-primary" href="' + esc(asset(pdf)) + '" download>Download invitation (PDF)</a></p>' +
      '<p data-if-exists="' + esc(asset(qr)) + '" hidden><img class="qr" src="' + esc(asset(qr)) + '" alt="QR code for this invitation" width="140" height="140" loading="lazy"></p>' +
      coupleImg(d.images.namaste, "couple-namaste", "Bride and groom with folded hands") +
      '<p class="footer-date">' + esc(s.footer_date) + "</p>" +
      "</footer>";
  }

  // Show optional bits (PDF, QR) only once the file actually exists.
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
      var vals = {
        days: Math.floor(secs / 86400),
        hours: Math.floor(secs % 86400 / 3600),
        mins: Math.floor(secs % 3600 / 60),
        secs: secs % 60
      };
      Object.keys(vals).forEach(function (k) {
        var el = section.querySelector('[data-unit="' + k + '"]');
        if (el) el.textContent = k === "days" ? vals[k] : String(vals[k]).padStart(2, "0");
      });
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // ---------- opening screen ----------
  function setupOpening() {
    var opening = document.getElementById("opening");
    if (!opening) return;
    // Skip the cover if it was already opened in this tab, or with ?open (used for screenshots).
    var seen = false;
    try { seen = sessionStorage.getItem("as-opened") === "1"; } catch (e) {}
    if (seen || /[?&]open\b/.test(location.search)) return;

    opening.hidden = false;
    document.body.classList.add("is-locked");
    var btn = document.getElementById("open-invitation");
    btn.focus();
    btn.addEventListener("click", function () {
      try { sessionStorage.setItem("as-opened", "1"); } catch (e) {}
      opening.classList.add("is-leaving");
      document.body.classList.remove("is-locked");
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(function () {
        opening.hidden = true;
        document.getElementById("app").focus({ preventScroll: true });
      }, reduce ? 0 : 600);
    });
  }

  // ---------- render ----------
  function render(d) {
    var list = eventsForVariant(d.events);
    document.getElementById("app").innerHTML =
      hero(d) + invitation(d) + countdown() + events(list) + venues(list) +
      rsvpSection(d) + gallery(d) + contacts(d.contacts) + footer(d);
    startCountdown(d);
    revealIfExists();
    if (window.initRsvp) window.initRsvp(d, VARIANT);
  }

  setupOpening();
  window.loadSiteData(render);
})();
