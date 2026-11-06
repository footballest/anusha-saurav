// RSVP form: validation, sending to the Google Apps Script web app, a thank-you card,
// and a WhatsApp fallback (pre-filled message to Saurav) when online sending isn't
// available. Re-submissions use the same device_id so the Sheet keeps only the latest.
(function () {
  "use strict";

  var DEVICE_KEY = "as-device-id";
  var draft = null;       // what the guest has typed, kept across re-renders
  var showForm = false;   // true after "Change my response"

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function deviceId() {
    var id = null;
    try { id = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (!id) {
      id = window.crypto && crypto.randomUUID ? crypto.randomUUID()
        : "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
  }
  function savedKey(variant) { return "as-rsvp-" + variant; }

  var FOOD = { veg: "Veg", nonveg: "Non-veg", any: "No preference" };

  // ---------- markup ----------
  function err(id) { return '<p class="field-error" id="err-' + id + '" hidden></p>'; }

  function formHtml(variant) {
    var eventChoices = variant === "full"
      ? '<fieldset class="field" id="rsvp-events" aria-describedby="err-events"><legend>Which celebrations will you attend?</legend>' +
          '<label class="check"><input type="checkbox" name="wedding" value="yes"> Wedding (16 Dec)</label>' +
          '<label class="check"><input type="checkbox" name="reception" value="yes"> Reception (19 Dec)</label>' +
          err("events") +
        "</fieldset>"
      : "";

    return '<form id="rsvp-form" class="rsvp-form" novalidate>' +
      '<label class="field">Your name <span aria-hidden="true">*</span>' +
        '<input type="text" name="name" required maxlength="80" autocomplete="name" aria-describedby="err-name"></label>' +
      err("name") +
      '<label class="field">Phone <span class="muted">(optional)</span>' +
        '<input type="tel" name="phone" maxlength="20" autocomplete="tel" inputmode="tel"></label>' +

      '<fieldset class="field" aria-describedby="err-attending"><legend>Will you join us?</legend>' +
        '<label class="check"><input type="radio" name="attending" value="yes" required> Joyfully accept</label>' +
        '<label class="check"><input type="radio" name="attending" value="no"> Regretfully decline</label>' +
        err("attending") +
      "</fieldset>" +

      '<div id="rsvp-accept" hidden>' +
        eventChoices +
        '<div class="field"><span id="guests-label">Number of guests, including you</span>' +
          '<div class="stepper" role="group" aria-labelledby="guests-label">' +
            '<button type="button" class="btn" data-step="-1" aria-label="One fewer guest">−</button>' +
            '<output name="guests" id="guests-out" aria-live="polite">1</output>' +
            '<button type="button" class="btn" data-step="1" aria-label="One more guest">+</button>' +
          "</div></div>" +
        '<fieldset class="field" id="rsvp-food"><legend>Food preference for the reception <span class="muted">(optional)</span></legend>' +
          '<label class="check"><input type="radio" name="food" value="veg"> Veg</label>' +
          '<label class="check"><input type="radio" name="food" value="nonveg"> Non-veg</label>' +
          '<label class="check"><input type="radio" name="food" value="any"> No preference</label>' +
        "</fieldset>" +
      "</div>" +

      '<label class="field">Blessings for the couple <span class="muted">(optional)</span>' +
        '<textarea name="message" rows="3" maxlength="500"></textarea></label>' +

      // Honeypot: hidden from people, bots fill it in.
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +

      '<button type="submit" class="btn btn-primary btn-block" id="rsvp-send">Send RSVP</button>' +
      '<div id="rsvp-status" role="status" aria-live="polite"></div>' +
      "</form>";
  }

  function thanksHtml(r, d) {
    var first = String(r.name).trim().split(/\s+/)[0];
    var body;
    if (r.attending === "yes") {
      var which = [];
      if (r.wedding) which.push("Wedding");
      if (r.reception) which.push("Reception");
      body = "<p>We can’t wait to celebrate with you.</p>" +
        '<p class="thanks-summary">' + esc(which.join(" & ")) + " · " + r.guests + (r.guests > 1 ? " guests" : " guest") +
        (r.food ? " · " + esc(r.food) : "") + "</p>";
    } else {
      body = "<p>We’ll miss you, and we’re grateful for your blessings.</p>";
    }
    var back = d.images && d.images.back;
    return '<div class="rsvp-thanks" tabindex="-1">' +
      (back ? '<img class="couple couple-thanks" src="' + esc(/^https?:/.test(back) ? back : (window.ROOT || "./") + back) +
        '" alt="" aria-hidden="true" loading="lazy" decoding="async" onerror="this.hidden=true">' : "") +
      '<p class="thanks-title">Thank you, ' + esc(first) + "!</p>" + body +
      '<button type="button" class="btn" id="rsvp-change">Change my response</button>' +
      "</div>";
  }

  window.renderRsvp = function (d) {
    if (!d.settings.rsvp_open) {
      return '<p class="center muted">RSVPs are now closed. Thank you! For anything else, please reach us through the contacts below.</p>';
    }
    return '<div id="rsvp-box"></div>';
  };

  // ---------- form helpers ----------
  function read(form, variant, guests) {
    var v = function (n) { var el = form.elements[n]; return el ? String(el.value || "").trim() : ""; };
    var att = form.querySelector('input[name="attending"]:checked');
    var attending = att ? att.value : "";
    var yes = attending === "yes";
    var wedding = variant === "full" && yes && form.elements.wedding.checked;
    var reception = yes && (variant === "reception" || form.elements.reception.checked);
    var food = form.querySelector('input[name="food"]:checked');
    return {
      name: v("name"),
      phone: v("phone"),
      attending: attending,
      wedding: wedding,
      reception: reception,
      guests: yes ? guests : 0,
      food: reception && food ? FOOD[food.value] : "",
      message: v("message").slice(0, 500),
      website: v("website")
    };
  }

  function fill(form, r, variant) {
    if (!r) return 1;
    form.elements.name.value = r.name || "";
    form.elements.phone.value = r.phone || "";
    form.elements.message.value = r.message || "";
    form.querySelectorAll('input[name="attending"]').forEach(function (i) { i.checked = i.value === r.attending; });
    if (variant === "full") {
      form.elements.wedding.checked = !!r.wedding;
      form.elements.reception.checked = !!r.reception;
    }
    var foodKey = Object.keys(FOOD).filter(function (k) { return FOOD[k] === r.food; })[0];
    form.querySelectorAll('input[name="food"]').forEach(function (i) { i.checked = i.value === foodKey; });
    return Math.min(10, Math.max(1, Number(r.guests) || 1));
  }

  function whatsappText(r, variant, d) {
    var s = d.settings;
    var lines = ["RSVP · " + s.couple_short + (variant === "full" ? " · Wedding & Reception" : " · Reception"), "Name: " + r.name];
    if (r.phone) lines.push("Phone: " + r.phone);
    if (r.attending === "yes") {
      var which = [];
      if (r.wedding) which.push("Wedding (16 Dec)");
      if (r.reception) which.push("Reception (19 Dec)");
      lines.push("Joyfully accept: " + which.join(", "));
      lines.push("Guests (including me): " + r.guests);
      if (r.food) lines.push("Reception food: " + r.food);
    } else {
      lines.push("Regretfully decline");
    }
    if (r.message) lines.push("Blessings: " + r.message);
    return lines.join("\n");
  }

  function whatsappNumber(d) {
    var n = d.settings.rsvp_whatsapp || (d.contacts[0] && d.contacts[0].phone_e164) || "";
    return String(n).replace(/\D/g, "");
  }

  function validate(form, r, variant) {
    var problems = [];
    function set(id, msg, focusEl) {
      var p = form.querySelector("#err-" + id);
      if (!p) return;
      p.textContent = msg || "";
      p.hidden = !msg;
      if (msg) problems.push(focusEl);
    }
    set("name", r.name.length < 2 ? "Please tell us your name." : "", form.elements.name);
    form.elements.name.setAttribute("aria-invalid", String(r.name.length < 2));
    set("attending", r.attending ? "" : "Please choose accept or decline.", form.querySelector('input[name="attending"]'));
    if (variant === "full") {
      set("events", r.attending === "yes" && !r.wedding && !r.reception ? "Please pick at least one celebration." : "", form.elements.wedding);
    }
    if (problems.length) problems[0].focus();
    return !problems.length;
  }

  function send(payload) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 15000);
    return fetch(window.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // a "simple" request: no CORS preflight
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) { return res.json(); })
      .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "failed"); return j; })
      .finally(function () { clearTimeout(timer); });
  }

  // ---------- main ----------
  window.initRsvp = function (d, variant) {
    var box = document.getElementById("rsvp-box");
    if (!box) return;
    var saved = store(savedKey(variant));

    if (saved && !showForm) {
      box.innerHTML = thanksHtml(saved, d);
      box.querySelector("#rsvp-change").addEventListener("click", function () {
        showForm = true;
        draft = draft || saved;
        window.initRsvp(d, variant);
        var f = document.getElementById("rsvp-form");
        if (f) f.elements.name.focus();
      });
      return;
    }

    box.innerHTML = formHtml(variant);
    var form = document.getElementById("rsvp-form");
    var accept = form.querySelector("#rsvp-accept");
    var food = form.querySelector("#rsvp-food");
    var out = form.querySelector("#guests-out");
    var status = form.querySelector("#rsvp-status");
    var btn = form.querySelector("#rsvp-send");

    // Pre-fill: what they were typing, else a name from ?to= on the reception link.
    var guests = fill(form, draft, variant);
    if (!draft) {
      var to = new URLSearchParams(location.search).get("to");
      if (to) form.elements.name.value = to.trim().slice(0, 80);
    }
    out.textContent = guests;

    function update() {
      var att = form.querySelector('input[name="attending"]:checked');
      accept.hidden = !(att && att.value === "yes");
      food.hidden = !(variant === "reception" || form.elements.reception.checked);
    }
    function remember() { draft = read(form, variant, guests); }

    form.addEventListener("change", function () { update(); remember(); });
    form.addEventListener("input", remember);
    form.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        guests = Math.min(10, Math.max(1, guests + Number(b.getAttribute("data-step"))));
        out.textContent = guests;
        remember();
      });
    });

    function done(r) {
      store(savedKey(variant), r);
      draft = null;
      showForm = false;
      window.initRsvp(d, variant);
      var t = box.querySelector(".rsvp-thanks");
      if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ behavior: "smooth", block: "center" }); }
    }

    function fallback(r, why) {
      var num = whatsappNumber(d);
      var href = "https://wa.me/" + num + "?text=" + encodeURIComponent(whatsappText(r, variant, d));
      status.innerHTML = '<div class="rsvp-fallback">' +
        "<p>" + (why === "offline" ? "We couldn’t send your reply online just now." : "Online RSVP isn’t available right now.") + "</p>" +
        "<p>Please send it to Saurav on WhatsApp instead. Your reply is already typed in; just tap send.</p>" +
        '<a class="btn btn-primary btn-block" id="rsvp-wa" href="' + esc(href) + '" target="_blank" rel="noopener">Send RSVP on WhatsApp</a>' +
        (window.API_URL ? '<button type="submit" class="btn btn-block">Try again</button>' : "") +
        "</div>";
      status.querySelector("#rsvp-wa").addEventListener("click", function () {
        var p = document.createElement("p");
        p.className = "form-note";
        p.textContent = "Thank you! Once the WhatsApp message is sent, we have your reply.";
        status.querySelector(".rsvp-fallback").appendChild(p);
      }, { once: true });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = read(form, variant, guests);
      status.innerHTML = "";
      if (!validate(form, r, variant)) return;
      if (r.website) { done(r); return; }   // a bot filled the honeypot: pretend it worked

      var payload = {
        type: "rsvp",
        variant: variant,
        device_id: deviceId(),
        timestamp: new Date().toISOString(),
        name: r.name, phone: r.phone, attending: r.attending,
        wedding: r.wedding, reception: r.reception, guests: r.guests,
        food: r.food, message: r.message,
        user_agent: navigator.userAgent.slice(0, 200)
      };
      if (!window.API_URL) { fallback(r, "off"); return; }

      btn.disabled = true;
      btn.textContent = "Sending…";
      send(payload)
        .then(function () { delete r.website; done(r); })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Send RSVP";
          fallback(r, "offline");
        });
    });

    update();
  };
})();
