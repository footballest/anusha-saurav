// Loads site content.
// 1. Render immediately from data/fallback.json (or the last copy cached in localStorage).
// 2. If API_URL is set, fetch fresh content from Google Apps Script and render again.
(function () {
  "use strict";

  // One cache per version of the site: the reception page only ever receives reception events.
  var CACHE_KEY = "as-config-v2-" + (window.VARIANT || "full");
  try { localStorage.removeItem("as-config-v1"); } catch (e) { /* old shared cache */ }

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

  // Normalise types (the Sheet sends everything as text) and sort, so the same content
  // from the Sheet and from fallback.json comes out identical.
  function normalise(d) {
    ["gallery_enabled", "rsvp_open", "music_enabled", "show_addresses", "notify_email_on_rsvp"].forEach(function (k) {
      d.settings[k] = toBool(d.settings[k]);
    });
    d.events.forEach(function (e) { e.order = Number(e.order) || 0; });
    // Keep only this version's events (the reception page never holds wedding details).
    var V = window.VARIANT;
    if (V === "full" || V === "reception") {
      d.events = d.events.filter(function (e) {
        return String(e.variants).split(",").map(function (x) { return x.trim(); }).indexOf(V) !== -1;
      });
    }
    d.events.sort(function (a, b) { return a.order - b.order; });
    d.contacts = d.contacts
      .map(function (c) {
        c.order = Number(c.order) || 0;
        c.whatsapp = toBool(c.whatsapp === undefined ? true : c.whatsapp);
        c.visible = toBool(c.visible === undefined ? true : c.visible);
        return c;
      })
      .filter(function (c) { return c.visible; })
      .sort(function (a, b) { return a.order - b.order; });
    return d;
  }

  window.loadSiteData = function (onData) {
    var root = window.ROOT || "./";
    fetch(root + "data/fallback.json")   // preloaded by the page
      .then(function (r) { return r.json(); })
      .then(function (fallback) {
        var cached = readCache();
        var shown = normalise(merge(fallback, cached));
        onData(shown);

        if (!window.API_URL) return;
        var url = window.API_URL + "?action=config&variant=" + encodeURIComponent(window.VARIANT);
        fetch(url)
          .then(function (r) { return r.json(); })
          .then(function (api) {
            if (!api || api.ok === false) return;
            writeCache(api);
            var fresh = normalise(merge(fallback, api));
            if (JSON.stringify(fresh) === JSON.stringify(shown)) return; // nothing changed: no re-render
            onData(fresh);
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
