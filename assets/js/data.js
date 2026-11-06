// Loads site content.
// 1. Render immediately from data/fallback.json (or the last copy cached in localStorage).
// 2. If API_URL is set, fetch fresh content from Google Apps Script and render again.
(function () {
  "use strict";

  var CACHE_KEY = "as-config-v1";

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function toBool(v) {
    if (typeof v === "boolean") return v;
    return String(v).trim().toUpperCase() === "TRUE";
  }

  // Merge API data over the fallback so missing keys still have a value.
  function merge(base, api) {
    var out = JSON.parse(JSON.stringify(base));
    if (!api) return out;
    if (api.settings) {
      Object.keys(api.settings).forEach(function (k) {
        var v = api.settings[k];
        // Settings tab can override illustration paths: image_hero, image_namaste, image_back.
        var m = /^image_(hero|namaste|back)$/.exec(k);
        if (m) { if (v) out.images[m[1]] = v; return; }
        out.settings[k] = v;
      });
    }
    if (api.families) Object.assign(out.families, api.families);
    if (Array.isArray(api.events) && api.events.length) out.events = api.events;
    if (Array.isArray(api.contacts) && api.contacts.length) out.contacts = api.contacts;
    return out;
  }

  // Normalise types (the Sheet sends strings) and sort.
  function normalise(d) {
    ["gallery_enabled", "rsvp_open", "music_enabled", "show_addresses"].forEach(function (k) {
      d.settings[k] = toBool(d.settings[k]);
    });
    d.events.sort(function (a, b) { return Number(a.order) - Number(b.order); });
    d.contacts = d.contacts
      .filter(function (c) { return toBool(c.visible === undefined ? true : c.visible); })
      .sort(function (a, b) { return Number(a.order) - Number(b.order); });
    return d;
  }

  window.loadSiteData = function (onData) {
    var root = window.ROOT || "./";
    fetch(root + "data/fallback.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (fallback) {
        var cached = readCache();
        onData(normalise(merge(fallback, cached)));

        if (!window.API_URL) return;
        var url = window.API_URL + "?action=config&variant=" + encodeURIComponent(window.VARIANT);
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (api) {
            if (!api || api.ok === false) return;
            if (JSON.stringify(api) === JSON.stringify(cached)) return; // nothing new
            writeCache(api);
            onData(normalise(merge(fallback, api)));
          })
          .catch(function () { /* offline or API down: keep fallback */ });
      })
      .catch(function (err) {
        console.error("Could not load data/fallback.json", err);
        document.getElementById("app").innerHTML =
          '<p class="noscript">Sorry, the invitation could not load. Please refresh the page.</p>';
      });
  };
})();
