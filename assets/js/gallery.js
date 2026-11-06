// Photo gallery (shown only when the gallery_enabled setting is TRUE).
// Albums come from the Apps Script endpoint ?action=gallery, which lists the files in
// the Drive "Approved" folders: { "Save the Date": [{id, name, w, h}], "Wedding": [...], ... }
// Images are shown through Google Drive thumbnails; a tap opens a lightbox.
(function () {
  "use strict";

  var ALBUMS = ["Save the Date", "Wedding", "Reception"];
  var albums = {}, current = "", index = 0, dlg = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Drive thumbnail, with a second address to try if Google blocks the first.
  function src(item, w) {
    if (item.src) return item.src;
    return "https://drive.google.com/thumbnail?id=" + encodeURIComponent(item.id) + "&sz=w" + w;
  }
  function altSrc(item, w) {
    return item.src ? "" : "https://lh3.googleusercontent.com/d/" + encodeURIComponent(item.id) + "=w" + w;
  }
  function retry(img, item, w) {
    img.hidden = false;
    img.onerror = function () {
      img.onerror = null;
      var alt = altSrc(item, w);
      if (alt) img.src = alt; else img.hidden = true;
    };
  }

  function slug(name) { return name.toLowerCase().replace(/[^a-z]+/g, "-"); }

  // ---------- grid ----------
  function renderAlbum(mount, name) {
    current = name;
    mount.querySelectorAll('[role="tab"]').forEach(function (t) {
      var on = t.getAttribute("data-album") === name;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    var panel = mount.querySelector(".gallery-panel");
    panel.setAttribute("aria-labelledby", "gtab-" + slug(name));
    var list = albums[name] || [];
    panel.innerHTML = '<ul class="gallery-grid">' + list.map(function (it, i) {
      return '<li><button type="button" class="gallery-thumb" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + " of " + list.length + '">' +
        '<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' + esc(src(it, 400)) + '"></button></li>';
    }).join("") + "</ul>";
    panel.querySelectorAll(".gallery-thumb img").forEach(function (img, i) { retry(img, list[i], 400); });
  }

  function renderAll(mount) {
    var names = ALBUMS.concat(Object.keys(albums).filter(function (k) { return ALBUMS.indexOf(k) < 0; }))
      .filter(function (k) { return albums[k] && albums[k].length; });
    if (!names.length) {
      mount.innerHTML = '<p class="muted center gallery-empty">Photos will appear here soon.</p>';
      return;
    }
    mount.innerHTML =
      (names.length > 1 ? '<div class="gallery-tabs" role="tablist" aria-label="Albums">' + names.map(function (n) {
        return '<button type="button" role="tab" id="gtab-' + slug(n) + '" data-album="' + esc(n) + '" aria-controls="gallery-panel">' + esc(n) + "</button>";
      }).join("") + "</div>" : "") +
      '<div class="gallery-panel" id="gallery-panel" role="tabpanel"></div>';

    var tabs = [].slice.call(mount.querySelectorAll('[role="tab"]'));
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { renderAlbum(mount, t.getAttribute("data-album")); });
      t.addEventListener("keydown", function (e) {
        var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!k) return;
        var next = tabs[(i + k + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });
    if (!mount.dataset.bound) {
      mount.dataset.bound = "1";
      mount.addEventListener("click", function (e) {
        var b = e.target.closest(".gallery-thumb");
        if (b) open(Number(b.getAttribute("data-i")), b);
      });
    }
    renderAlbum(mount, names[0]);
  }

  // ---------- lightbox ----------
  var opener = null;
  function buildDialog() {
    dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Photo viewer");
    dlg.innerHTML =
      '<figure><img alt="" referrerpolicy="no-referrer"><figcaption aria-live="polite"></figcaption></figure>' +
      '<button type="button" class="lb-btn lb-close" aria-label="Close">×</button>' +
      '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">‹</button>' +
      '<button type="button" class="lb-btn lb-next" aria-label="Next photo">›</button>';
    document.body.appendChild(dlg);
    dlg.querySelector(".lb-close").addEventListener("click", close);
    dlg.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
    dlg.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.tagName === "FIGURE") close(); });
    dlg.addEventListener("close", function () { document.body.classList.remove("is-locked"); if (opener) opener.focus(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    });
    var x0 = null;
    dlg.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    });
  }

  function show(i) {
    var list = albums[current] || [];
    if (!list.length) return;
    index = (i + list.length) % list.length;
    var it = list[index];
    var img = dlg.querySelector("img");
    img.removeAttribute("src");
    retry(img, it, 1600);
    img.src = src(it, 1600);
    img.alt = current + " photo " + (index + 1);
    dlg.querySelector("figcaption").textContent = current + " · " + (index + 1) + " / " + list.length;
    var many = list.length > 1;
    dlg.querySelector(".lb-prev").hidden = !many;
    dlg.querySelector(".lb-next").hidden = !many;
  }

  function open(i, from) {
    if (!dlg) buildDialog();
    opener = from || null;
    show(i);
    document.body.classList.add("is-locked");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    dlg.querySelector(".lb-close").focus();
  }
  function close() {
    if (dlg.close) dlg.close(); else { dlg.removeAttribute("open"); dlg.dispatchEvent(new Event("close")); }
  }

  // ---------- load ----------
  window.Gallery = {
    init: function (d) {
      var mount = document.getElementById("gallery-mount");
      if (!mount || !d.settings.gallery_enabled) return;
      if (!window.API_URL) { renderAll(mount); return; }
      mount.innerHTML = '<p class="muted center gallery-empty">Loading photos…</p>';
      fetch(window.API_URL + "?action=gallery")
        .then(function (r) { return r.json(); })
        .then(function (j) {
          albums = {};
          Object.keys(j || {}).forEach(function (k) { if (Array.isArray(j[k])) albums[k] = j[k]; });
          renderAll(mount);
        })
        .catch(function () { albums = {}; renderAll(mount); });
    }
  };
})();
