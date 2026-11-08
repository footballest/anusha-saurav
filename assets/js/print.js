// Renders the one-page A5 invitation for the PDFs (print/index.html?v=full|reception).
// Same data as the site; only this version's events are ever rendered.
(function () {
  "use strict";

  var V = window.VARIANT === "reception" ? "reception" : "full";
  var ROOT = window.ROOT || "../";
  var IMG = ROOT + "assets/img/";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function asset(p) { return /^https?:/.test(p) ? p : ROOT + p; }
  function phonePretty(e164) {
    var m = /^\+91(\d{5})(\d{5})$/.exec(e164);
    return m ? "+91 " + m[1] + " " + m[2] : e164;
  }
  function forVariant(e) {
    return String(e.variants).split(",").map(function (x) { return x.trim(); }).indexOf(V) !== -1;
  }

  // Kasavu band drawn as plain shapes (no repeating background image), because iPhone/Mac
  // PDF viewers render tiled backgrounds badly. Same artwork as assets/img/kasavu-border.svg.
  function band(cls) {
    var W = 592, out = "";
    for (var x = 0; x <= W; x += 48) {
      out += '<path d="M' + (x + 12) + ' 9.2l3.4 2.8-3.4 2.8-3.4-2.8z M' + (x + 36) + ' 9.2l3.4 2.8-3.4 2.8-3.4-2.8z" fill="#F3E2A6"/>' +
        '<circle cx="' + (x + 12) + '" cy="12" r="1" fill="#C49A3A"/><circle cx="' + (x + 36) + '" cy="12" r="1" fill="#C49A3A"/>' +
        '<circle cx="' + x + '" cy="12" r=".9" fill="#F3E2A6"/><circle cx="' + (x + 24) + '" cy="12" r=".9" fill="#F3E2A6"/>';
    }
    return '<svg class="p-band ' + cls + '" viewBox="0 0 ' + W + ' 24" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect width="' + W + '" height="24" fill="#FFFBF3"/>' +
      '<rect y=".6" width="' + W + '" height="1" fill="#2F5D3A"/><rect y="3" width="' + W + '" height="1.6" fill="#C49A3A"/>' +
      '<rect y="6.4" width="' + W + '" height="11.2" fill="#C49A3A"/><rect y="7.4" width="' + W + '" height=".6" fill="#E2C878"/>' +
      '<rect y="16" width="' + W + '" height=".6" fill="#E2C878"/>' + out +
      '<rect y="19.4" width="' + W + '" height="1.6" fill="#C49A3A"/><rect y="22.4" width="' + W + '" height="1" fill="#2F5D3A"/></svg>';
  }

  function family(name, rel, parents) {
    return '<div class="p-family"><p class="p-child">' + esc(name) + "</p>" +
      '<p class="p-rel">' + rel + "</p>" +
      '<p class="p-parents">' + esc(parents).replace(" &amp; ", " &amp;<br>") + "</p></div>";
  }

  function event(e) {
    return '<div class="p-event">' +
      '<p class="p-ml" lang="ml">' + esc(e.name_ml) + "</p>" +
      '<p class="p-ename">' + esc(e.name_en) + "</p>" +
      '<p class="p-date">' + esc(e.date_label) + "</p>" +
      '<p class="p-time">' + esc(e.time_label) + "</p>" +
      '<p class="p-venue">' + esc(e.venue) + "</p>" +
      '<p class="p-addr">' + esc(e.address) + "</p>" +
      "</div>";
  }

  function render(d) {
    var s = d.settings, f = d.families;
    var events = d.events.filter(forVariant);
    var qr = V === "full" ? d.files.qr_full : d.files.qr_reception;
    var intro = V === "full"
      ? '<p class="p-intro">' + rich(s.full_intro) + "</p>"
      : '<p class="p-greeting">' + esc(String(s.reception_greeting).replace("{name}", "guest")) + "</p>" +
        '<p class="p-intro">' + rich(s.reception_intro) + "</p>";

    var sheet = document.getElementById("sheet");
    sheet.className = "sheet v-" + V;
    sheet.innerHTML =
      band("top") + band("bottom") +
      '<div class="p-frame" aria-hidden="true"></div>' +
      '<header class="p-head">' +
        '<img class="p-ganapathi" src="' + IMG + 'ganapathi.svg" alt="">' +
        '<p class="p-invocation" lang="ml">' + esc(s.invocation) + "</p>" +
      "</header>" +
      '<div class="p-hero">' +
        '<img class="p-lamp" src="' + IMG + 'nilavilakku.svg" alt="">' +
        '<img class="p-couple" src="' + esc(asset(d.images.hero)) + '" alt="">' +
        '<img class="p-lamp" src="' + IMG + 'nilavilakku.svg" alt="">' +
      "</div>" +
      '<h1 class="p-names">Anusha <span>&amp;</span> Saurav</h1>' +
      intro +
      '<div class="p-families">' +
        family(s.bride_name, "daughter of", f.bride_parents) +
        '<p class="p-amp" aria-hidden="true">&amp;</p>' +
        family(s.groom_name, "son of", f.groom_parents) +
      "</div>" +
      '<img class="p-rule" src="' + IMG + 'flourish.svg" alt="">' +
      '<div class="p-events n' + events.length + '">' + events.map(event).join("") + "</div>" +
      '<div class="p-bottom">' +
        '<div class="p-contacts"><p class="p-label">For any help</p><ul>' +
          d.contacts.map(function (c) {
            return "<li><b>" + esc(c.name) + "</b> · " + esc(c.relation) + '<br><span class="p-phone">' + esc(phonePretty(c.phone_e164)) + "</span></li>";
          }).join("") +
        "</ul></div>" +
        '<div class="p-qr"><img src="' + esc(asset(qr)) + '" alt=""><p>Scan for the invitation,<br>directions &amp; RSVP</p></div>' +
      "</div>" +
      '<footer class="p-foot">' +
        '<p class="p-label">Sharing the happiness</p>' +
        '<p class="p-sharing">' + esc(s.sharing_the_happiness) + "</p>" +
      "</footer>";

    var n = Number(document.documentElement.getAttribute("data-renders") || 0) + 1;
    document.documentElement.setAttribute("data-renders", String(n));
  }

  window.loadSiteData(render);
})();
