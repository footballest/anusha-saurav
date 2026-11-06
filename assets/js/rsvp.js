// RSVP form. Phase 1: layout and show/hide logic only.
// Sending to Google Sheets + WhatsApp fallback is added in Phase 4.
(function () {
  "use strict";

  window.renderRsvp = function (d, variant) {
    if (!d.settings.rsvp_open) {
      return '<p class="center muted">RSVPs are now closed. Thank you! For anything else, please reach us through the contacts below.</p>';
    }
    var eventChoices = variant === "full"
      ? '<fieldset class="field" id="rsvp-events"><legend>Which celebrations will you attend?</legend>' +
          '<label class="check"><input type="checkbox" name="wedding" value="yes"> Wedding (16 Dec)</label>' +
          '<label class="check"><input type="checkbox" name="reception" value="yes"> Reception (19 Dec)</label>' +
        "</fieldset>"
      : "";

    return '<form id="rsvp-form" class="card rsvp-form" novalidate>' +
      '<label class="field">Your name <span aria-hidden="true">*</span>' +
        '<input type="text" name="name" required maxlength="80" autocomplete="name"></label>' +
      '<label class="field">Phone <span class="muted">(optional)</span>' +
        '<input type="tel" name="phone" maxlength="20" autocomplete="tel"></label>' +

      '<fieldset class="field"><legend>Will you join us?</legend>' +
        '<label class="check"><input type="radio" name="attending" value="yes" required> Joyfully accept</label>' +
        '<label class="check"><input type="radio" name="attending" value="no"> Regretfully decline</label>' +
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

      '<button type="submit" class="btn btn-primary btn-block">Send RSVP</button>' +
      '<p class="form-note muted" id="rsvp-note" role="status"></p>' +
      "</form>";
  };

  window.initRsvp = function (d, variant) {
    var form = document.getElementById("rsvp-form");
    if (!form) return;
    var accept = form.querySelector("#rsvp-accept");
    var food = form.querySelector("#rsvp-food");
    var out = form.querySelector("#guests-out");
    var guests = 1;

    function update() {
      var att = form.querySelector('input[name="attending"]:checked');
      accept.hidden = !(att && att.value === "yes");
      var receptionOn = variant === "reception" || form.querySelector('input[name="reception"]').checked;
      food.hidden = !receptionOn;
    }
    form.addEventListener("change", update);
    form.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        guests = Math.min(10, Math.max(1, guests + Number(b.getAttribute("data-step"))));
        out.textContent = guests;
      });
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelector("#rsvp-note").textContent = "RSVP sending will be switched on soon (Phase 4).";
    });
    update();
  };
})();
