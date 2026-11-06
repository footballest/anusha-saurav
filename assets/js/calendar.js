// "Add to calendar": a Google Calendar link and an .ics file made in the browser.
// Only the events shown on this version of the site are ever passed in, so the
// Reception page can never produce a wedding calendar entry.
(function () {
  "use strict";

  var VARIANT = window.VARIANT === "reception" ? "reception" : "full";

  // "2026-12-19T17:00:00+05:30" -> "20261219T113000Z"
  function utc(iso) {
    return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function pageUrl() {
    var base = window.BASE_URL || "";
    return VARIANT === "reception" ? base + "reception/" : base;
  }

  function details(e, d) {
    var s = d.settings;
    return [
      e.name_en + " of " + s.bride_name + " & " + s.groom_name,
      e.date_label + " · " + e.time_label,
      e.venue + ", " + e.address,
      "Directions: " + e.maps_url,
      pageUrl() ? "Invitation: " + pageUrl() : ""
    ].filter(Boolean).join("\n");
  }

  function summary(e, d) { return d.settings.couple_short + " · " + e.name_en; }
  function where(e) { return e.venue + ", " + e.address; }

  function googleUrl(e, d) {
    var p = new URLSearchParams({
      action: "TEMPLATE",
      text: summary(e, d),
      dates: utc(e.start_iso) + "/" + utc(e.end_iso),
      details: details(e, d),
      location: where(e),
      ctz: "Asia/Kolkata"
    });
    return "https://calendar.google.com/calendar/render?" + p.toString();
  }

  // iCalendar text values escape \ ; , and newlines.
  function icsText(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  // Lines longer than 75 bytes are folded (CRLF + space), never splitting a character.
  function fold(line) {
    var enc = new TextEncoder(), out = "", cur = "", bytes = 0;
    Array.from(line).forEach(function (ch) {
      var b = enc.encode(ch).length;
      if (bytes + b > (out ? 74 : 75)) { out += (out ? "\r\n " : "") + cur; cur = ""; bytes = 0; }
      cur += ch; bytes += b;
    });
    return out ? out + "\r\n " + cur : cur;
  }

  function ics(e, d) {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Anusha & Saurav//Invitation//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + e.id + "-" + utc(e.start_iso).slice(0, 8) + "@anusha-saurav",
      "DTSTAMP:" + utc(new Date().toISOString()),
      "DTSTART:" + utc(e.start_iso),
      "DTEND:" + utc(e.end_iso),
      "SUMMARY:" + icsText(summary(e, d)),
      "LOCATION:" + icsText(where(e)),
      "DESCRIPTION:" + icsText(details(e, d)),
      pageUrl() ? "URL:" + pageUrl() : "",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + icsText(summary(e, d) + " is tomorrow"),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean);
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  function fileName(e) {
    return "Anusha-Saurav-" + (e.id === "wedding" ? "Wedding" : e.id === "reception" ? "Reception" : e.id) + ".ics";
  }

  function download(e, d) {
    var text = ics(e, d);
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      // iPhone Safari opens a data: calendar file straight into "Add to Calendar".
      location.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(text);
      return;
    }
    var url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName(e);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // Markup for an event card: toggle button + a small menu under the button row.
  function menuHtml(e, d) {
    var id = "cal-" + e.id;
    return '<div class="cal-menu" id="' + id + '" hidden>' +
      '<a class="btn" href="' + googleUrl(e, d).replace(/&/g, "&amp;") + '" target="_blank" rel="noopener">Google Calendar</a>' +
      '<button type="button" class="btn" data-ics="' + e.id + '">Apple / Outlook (.ics)</button>' +
      "</div>";
  }

  var current = { list: [], d: null };
  function bind(root, list, d) {
    current.list = list;
    current.d = d;
    if (root.dataset.calBound) return;
    root.dataset.calBound = "1";
    root.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-cal-toggle], [data-ics]");
      if (!t) return;
      if (t.hasAttribute("data-cal-toggle")) {
        var menu = document.getElementById(t.getAttribute("aria-controls"));
        var open = t.getAttribute("aria-expanded") !== "true";
        t.setAttribute("aria-expanded", String(open));
        menu.hidden = !open;
        return;
      }
      var e = current.list.filter(function (x) { return x.id === t.getAttribute("data-ics"); })[0];
      if (e) download(e, current.d);
    });
  }

  window.Calendar = { googleUrl: googleUrl, ics: ics, download: download, menuHtml: menuHtml, bind: bind };
})();
