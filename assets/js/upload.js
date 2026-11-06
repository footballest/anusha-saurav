// Photo upload page (/upload/). Photos are resized in the browser (max 2560 px on the
// long edge, JPEG 0.85) and sent in batches of 3 to the Apps Script web app, which checks
// the passcode and saves them to the private "Pending uploads" Drive folder.
(function () {
  "use strict";

  var MAX_EDGE = 2560, QUALITY = 0.85, BATCH = 3;
  var RAW_LIMIT = 15 * 1024 * 1024;   // largest file sent as-is when the browser can't resize it (e.g. HEIC on Android)
  var NAME_KEY = "as-uploader";
  var OK_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

  var items = [];   // {id, file, li, state: ready|skipped|working|done|failed}
  var busy = false, uid = 0;

  var form = document.getElementById("upload-form");
  var input = form.elements.photos;
  var list = document.getElementById("file-list");
  var summary = document.getElementById("upload-summary");
  var status = document.getElementById("upload-status");
  var sendBtn = document.getElementById("upload-send");
  var zone = form.querySelector(".dropzone");

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function typeOf(file) {
    if (file.type) return file.type.toLowerCase();
    var m = /\.(heic|heif)$/i.exec(file.name);
    return m ? "image/" + m[1].toLowerCase() : "";
  }

  // ---------- page dressing from the shared data (theme + namaste illustration) ----------
  if (window.loadSiteData) {
    window.loadSiteData(function (d) {
      var t = d.settings.theme;
      if (!document.documentElement.hasAttribute("data-theme-locked") && /^(green|kasavu|lotus|maroon)$/.test(t || "")) {
        document.documentElement.setAttribute("data-theme", t);
      }
      var box = document.getElementById("upload-couple");
      var src = d.images && d.images.namaste;
      if (box && src && !box.firstChild) {
        box.innerHTML = '<img class="couple couple-upload" src="' + esc(/^https?:/.test(src) ? src : "../" + src) +
          '" alt="" aria-hidden="true" decoding="async" onerror="this.hidden=true">';
      }
    });
  }
  try { form.elements.uploader.value = localStorage.getItem(NAME_KEY) || ""; } catch (e) {}

  // ---------- file list ----------
  function setItem(it, state, text, pct) {
    it.state = state;
    it.li.className = "file-item is-" + state;
    it.li.querySelector(".file-status").textContent = text;
    var bar = it.li.querySelector(".bar i");
    if (pct != null) bar.style.width = pct + "%";
    var rm = it.li.querySelector(".file-remove");
    if (rm) rm.hidden = !(state === "ready" || state === "skipped" || state === "failed") || busy;
  }

  function addFiles(files) {
    [].forEach.call(files, function (file) {
      var it = { id: ++uid, file: file };
      var li = document.createElement("li");
      var type = typeOf(file);
      var preview = /^image\/(jpeg|png|webp)$/.test(type) ? URL.createObjectURL(file) : "";
      li.innerHTML =
        '<span class="file-thumb">' + (preview ? '<img alt="" src="' + preview + '">' : '<span aria-hidden="true">✿</span>') + "</span>" +
        '<span class="file-main"><span class="file-name">' + esc(file.name) + '</span>' +
        '<span class="file-meta"><span class="file-size">' + mb(file.size) + '</span> · <span class="file-status"></span></span>' +
        '<span class="bar" aria-hidden="true"><i></i></span></span>' +
        '<button type="button" class="file-remove" aria-label="Remove ' + esc(file.name) + '">×</button>';
      it.li = li;
      li.querySelector(".file-remove").addEventListener("click", function () {
        items = items.filter(function (x) { return x !== it; });
        if (preview) URL.revokeObjectURL(preview);
        li.remove();
        refresh();
      });
      list.appendChild(li);
      items.push(it);
      if (/^video\//.test(type)) setItem(it, "skipped", "Videos can’t be uploaded here", 0);
      else if (!OK_TYPES.test(type)) setItem(it, "skipped", "Not a photo, skipped", 0);
      else setItem(it, "ready", "Ready", 0);
    });
    refresh();
  }

  function refresh() {
    var c = { ready: 0, done: 0, failed: 0, skipped: 0 };
    items.forEach(function (it) { if (c[it.state] != null) c[it.state]++; });
    var todo = c.ready + c.failed;
    var parts = [];
    if (c.done) parts.push(c.done + " uploaded");
    if (todo) parts.push(todo + (todo === 1 ? " photo" : " photos") + " to upload");
    if (c.skipped) parts.push(c.skipped + " skipped");
    summary.textContent = parts.join(" · ");
    sendBtn.textContent = busy ? "Uploading…" : c.failed && !c.ready ? "Try again" : todo ? "Upload " + todo + (todo === 1 ? " photo" : " photos") : "Upload photos";
    sendBtn.disabled = busy;
  }

  input.addEventListener("change", function () {
    addFiles(input.files);
    input.value = "";   // allow picking the same files again
    showError("photos", "");
  });
  ["dragenter", "dragover"].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
  });
  zone.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

  // ---------- resize ----------
  function decode(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaImg(file); });
    }
    return viaImg(file);
  }
  function viaImg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); res(img); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("decode")); };
      img.src = url;
    });
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1]); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }
  function jpegName(name) { return name.replace(/\.[^.]+$/, "") + ".jpg"; }

  // -> {name, mime, base64, size}
  function prepare(file) {
    var type = typeOf(file);
    return decode(file).then(function (img) {
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var k = Math.min(1, MAX_EDGE / Math.max(w, h));
      // Already a small-enough JPEG: send it untouched.
      if (k === 1 && type === "image/jpeg") return { blob: file, name: file.name, mime: "image/jpeg" };
      var c = document.createElement("canvas");
      c.width = Math.round(w * k);
      c.height = Math.round(h * k);
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";              // PNGs with transparency get a white background
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      return new Promise(function (res) { c.toBlob(res, "image/jpeg", QUALITY); }).then(function (blob) {
        if (!blob) throw new Error("encode");
        return { blob: blob, name: jpegName(file.name), mime: "image/jpeg" };
      });
    }).catch(function () {
      // The browser can't open it (usually HEIC on Android/Chrome): send the original if not huge.
      if (/heic|heif/.test(type) && file.size <= RAW_LIMIT) return { blob: file, name: file.name, mime: type };
      throw new Error("cannot_read");
    }).then(function (p) {
      return toBase64(p.blob).then(function (b64) { return { name: p.name, mime: p.mime, base64: b64, size: p.blob.size }; });
    });
  }

  // ---------- send ----------
  function post(body) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 120000);
    return fetch(window.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },   // no CORS preflight
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  function showError(field, msg) {
    var p = document.getElementById("err-" + field);
    p.textContent = msg;
    p.hidden = !msg;
    var el = form.elements[field];
    if (el && el.setAttribute) el.setAttribute("aria-invalid", String(!!msg));
  }

  function runBatches(uploader, passcode) {
    var queue = items.filter(function (it) { return it.state === "ready" || it.state === "failed"; });
    var stopped = false;

    function next() {
      if (stopped || !queue.length) return Promise.resolve();
      var batch = queue.splice(0, BATCH);
      var prepared = [];
      return batch.reduce(function (p, it) {
        return p.then(function () {
          setItem(it, "working", "Getting ready…", 15);
          return prepare(it.file).then(function (f) {
            it.li.querySelector(".file-size").textContent = mb(it.file.size) + (f.size < it.file.size ? " → " + mb(f.size) : "");
            setItem(it, "working", window.API_URL ? "Waiting to send…" : "Ready to send", 40);
            prepared.push({ it: it, f: f });
          }).catch(function () {
            setItem(it, "failed", "Couldn’t read this photo", 0);
          });
        });
      }, Promise.resolve()).then(function () {
        if (!prepared.length) return next();
        if (!window.API_URL) {   // backend not connected yet: stop after preparing
          prepared.forEach(function (x) { setItem(x.it, "ready", "Prepared, not sent (uploads aren’t switched on yet)", 40); });
          return next();
        }
        prepared.forEach(function (x) { setItem(x.it, "working", "Uploading…", 70); x.it.li.classList.add("is-sending"); });
        return post({
          type: "upload",
          passcode: passcode,
          uploader: uploader,
          files: prepared.map(function (x) { return { name: x.f.name, mime: x.f.mime, base64: x.f.base64 }; })
        }).then(function (j) {
          if (j && j.ok) {
            prepared.forEach(function (x) { setItem(x.it, "done", "Uploaded ✓", 100); });
            refresh();
            return next();
          }
          var bad = j && /passcode/i.test(j.error || "");
          prepared.forEach(function (x) { setItem(x.it, bad ? "ready" : "failed", bad ? "Not sent" : "Couldn’t upload", 0); });
          if (bad) {
            stopped = true;
            queue.forEach(function (it) { setItem(it, "ready", "Ready", 0); });
            showError("passcode", "That passcode didn’t work. Please check it and try again.");
            form.elements.passcode.focus();
            return;
          }
          refresh();
          return next();
        }).catch(function () {
          prepared.forEach(function (x) { setItem(x.it, "failed", "Couldn’t upload (connection)", 0); });
          refresh();
          return next();
        });
      });
    }
    return next();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    status.innerHTML = "";
    var uploader = form.elements.uploader.value.trim();
    var passcode = form.elements.passcode.value.trim();
    var todo = items.filter(function (it) { return it.state === "ready" || it.state === "failed"; });
    showError("uploader", uploader.length < 2 ? "Please tell us your name." : "");
    showError("passcode", passcode ? "" : "Please enter the passcode.");
    showError("photos", todo.length ? "" : "Please choose at least one photo.");
    var firstBad = form.querySelector('[aria-invalid="true"]');
    if (firstBad) { firstBad.focus(); return; }
    if (!todo.length) { input.focus(); return; }
    try { localStorage.setItem(NAME_KEY, uploader); } catch (err) {}

    busy = true;
    refresh();
    items.forEach(function (it) { var rm = it.li.querySelector(".file-remove"); if (rm) rm.hidden = true; });
    runBatches(uploader, passcode).then(function () {
      busy = false;
      items.forEach(function (it) { setItem(it, it.state, it.li.querySelector(".file-status").textContent); });
      refresh();
      var done = items.filter(function (it) { return it.state === "done"; }).length;
      var failed = items.filter(function (it) { return it.state === "failed"; }).length;
      if (!window.API_URL) {
        status.innerHTML = '<p class="form-note">Uploading isn’t switched on yet. Please try again a little later.</p>';
      } else if (done && !failed && !items.some(function (it) { return it.state === "ready"; })) {
        status.innerHTML = '<p class="upload-thanks">Thank you! ' + done + (done === 1 ? " photo" : " photos") + " received.</p>";
      } else if (failed) {
        status.innerHTML = '<p class="form-note">Some photos didn’t go through. Tap “Try again” to resend them.</p>';
      }
    });
  });

  refresh();
})();
