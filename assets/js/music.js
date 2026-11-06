// Background music: off by default, a round veena button toggles it.
// Hidden entirely when music_enabled is false or the audio file is missing.
// Loops at volume 0.4 with a 1 s fade in/out; the choice is remembered on this device.
(function () {
  "use strict";

  var PREF = "as-music";
  var VOLUME = 0.4, FADE_MS = 1000;
  var audio = null, btn = null, fadeTimer = null, wantOn = false, pausedByHide = false;

  // Saraswati veena: round bowl (kudam), neck, small gourd underneath, curled head.
  var VEENA = '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-32 12 12)">' +
    '<path d="M1.2 10.1h8.4a4.9 4.9 0 1 1-8.4 0z" fill="currentColor"/>' +
    '<rect x="9" y="10.1" width="11.2" height="2.1" rx=".5" fill="currentColor"/>' +
    '<path d="M15.4 12.2v1" stroke="currentColor" stroke-width="1"/>' +
    '<circle cx="15.4" cy="14.9" r="2" fill="currentColor"/>' +
    '<path d="M1.4 9.5h18.8" stroke="currentColor" stroke-width=".6"/>' +
    '<path d="M20 10.4c1.8-.1 2.8-1.5 2.2-2.8-.5-.9-1.7-.6-1.6.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
    "</g></svg>";

  function pref(v) {
    try {
      if (v === undefined) return localStorage.getItem(PREF);
      localStorage.setItem(PREF, v);
    } catch (e) { return null; }
  }

  // Fade the element's volume. (iPhones ignore volume changes, so there it simply starts/stops.)
  function fadeTo(target, then) {
    clearInterval(fadeTimer);
    var start = audio.volume, t0 = Date.now();
    fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / FADE_MS);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if (k >= 1) { clearInterval(fadeTimer); if (then) then(); }
    }, 40);
  }

  function setUi(on) {
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Pause music" : "Play music");
    btn.title = on ? "Pause music" : "Play music";
    btn.classList.toggle("is-playing", on);
  }

  function play() {
    wantOn = true;
    setUi(true);
    audio.volume = 0;
    var p = audio.play();
    if (p && p.catch) p.catch(function () { wantOn = false; setUi(false); });
    fadeTo(VOLUME);
  }
  function pause() {
    wantOn = false;
    setUi(false);
    fadeTo(0, function () { audio.pause(); });
  }

  function build(src) {
    audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.preload = "none";
    audio.addEventListener("error", function () { if (btn) btn.hidden = true; });

    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-btn";
    btn.innerHTML = VEENA;
    setUi(false);
    btn.addEventListener("click", function () {
      if (wantOn) { pause(); pref("off"); } else { play(); pref("on"); }
    });
    document.body.appendChild(btn);

    // If they turned music on during an earlier visit, start again on their first tap
    // (the Open Invitation tap, or any click/key press when the cover is skipped).
    if (pref() === "on") {
      var armed = true;
      var resume = function (e) {
        if (!armed) return;
        armed = false;   // only ever once
        var t = e && e.target;
        if (t && t.closest && t.closest(".music-btn")) return; // they used the button itself
        if (!wantOn) play();
      };
      document.addEventListener("invitation:open-tap", resume);
      document.addEventListener("click", resume, true);
      document.addEventListener("keydown", resume, true);
    }

    // Pause while the tab is in the background; resume when they come back.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && wantOn) { pausedByHide = true; audio.pause(); }
      else if (!document.hidden && pausedByHide) { pausedByHide = false; if (wantOn) audio.play().catch(function () {}); }
    });
  }

  window.Music = {
    init: function (d) {
      if (btn) { btn.hidden = !d.settings.music_enabled; if (!d.settings.music_enabled && wantOn) pause(); return; }
      if (!d.settings.music_enabled || !d.files || !d.files.music) return;
      var src = /^https?:/.test(d.files.music) ? d.files.music : (window.ROOT || "./") + d.files.music;
      fetch(src, { method: "HEAD" })
        .then(function (r) { if (r.ok && !btn) build(src); })
        .catch(function () {});
    }
  };
})();
