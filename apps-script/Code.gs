/**
 * Anusha & Saurav · wedding site backend (Google Apps Script, bound to the Google Sheet).
 *
 * Paste this whole file into the Sheet's  Extensions → Apps Script → Code.gs,
 * run setup() once, then deploy as a Web app. Step-by-step: apps-script/README.md.
 *
 * Public (anyone with the web app URL):
 *   GET  ?action=config&variant=full|reception  → { settings, events, contacts, families }
 *        (the reception variant only ever gets reception events)
 *   GET  ?action=gallery                        → { "Save the Date": [{id}], "Wedding": [...], "Reception": [...] }
 *   POST {type:"rsvp", ...}                     → appended to the RSVP tab, Summary rebuilt, optional email
 *   POST {type:"upload", passcode, uploader, files:[{name, mime, base64}]} → saved to Drive "Pending uploads"
 *
 * Never returned to anyone: the RSVP, Summary and Uploads tabs, the passcode, folder IDs.
 * Every response is JSON: {ok:true, ...} or {ok:false, error:"<code>"}.
 */

var TZ = 'Asia/Kolkata';
var CACHE_SECONDS = 300;   // the site sees Sheet edits within 5 minutes (or at once via the menu / onEdit)

var TAB = {
  settings: 'Settings', events: 'Events', contacts: 'Contacts', families: 'Families',
  rsvp: 'RSVP', summary: 'Summary', uploads: 'Uploads'
};
var HEAD = {
  Settings: ['key', 'value', 'note'],
  Events: ['id', 'name_en', 'name_ml', 'date_label', 'time_label', 'start_iso', 'end_iso',
           'venue', 'address', 'maps_url', 'variants', 'order'],
  Contacts: ['name', 'relation', 'phone_e164', 'whatsapp', 'order', 'visible'],
  Families: ['key', 'text'],
  RSVP: ['timestamp', 'variant', 'device_id', 'name', 'phone', 'attending', 'wedding',
         'reception', 'guests', 'food', 'message', 'user_agent'],
  Uploads: ['timestamp', 'uploader_name', 'file_name', 'drive_file_id', 'status']
};
var PUBLIC_TABS = [TAB.settings, TAB.events, TAB.contacts, TAB.families];

var ALBUMS = ['Save the Date', 'Wedding', 'Reception'];
var FOLDER_PROP = {
  root: 'FOLDER_ROOT', pending: 'FOLDER_PENDING', approved: 'FOLDER_APPROVED',
  'Save the Date': 'FOLDER_SAVE_THE_DATE', 'Wedding': 'FOLDER_WEDDING', 'Reception': 'FOLDER_RECEPTION'
};
var ROOT_FOLDER_NAME = 'Anusha-Saurav Wedding';

var OK_MIME = /^image\/(jpeg|png|webp|heic|heif)$/;
var MAX_FILES = 10;
var MAX_FILE_BYTES = 20 * 1024 * 1024;
var MAX_PASSCODE_FAILS = 20;              // per 10 minutes, across everyone
var FOOD = ['Veg', 'Non-veg', 'No preference'];

// Starting content for the public tabs (copied from data/fallback.json). After setup()
// the Sheet is the source of truth: edit the Sheet, not this block.
var SEED = {
  settings: [
    ["couple_short", "Anusha & Saurav", "Short names used in titles and calendar entries"],
    ["theme", "green", "Colour theme: green · kasavu · lotus · maroon"],
    ["bride_name", "Anusha T K", "Shown above 'daughter of'"],
    ["groom_name", "Saurav Krishna", "Shown above 'son of'"],
    ["initials", "A ❀ S", "Monogram on the opening screen"],
    ["invocation", "॥ ശ്രീ മഹാഗണപതയേ നമഃ ॥", "Malayalam line at the very top"],
    ["gallery_enabled", "FALSE", "TRUE shows the photo gallery (after the wedding)"],
    ["rsvp_open", "TRUE", "FALSE closes the RSVP form with a polite note"],
    ["music_enabled", "TRUE", "FALSE hides the music button"],
    ["show_addresses", "FALSE", "TRUE shows the house names under the parents"],
    ["notify_email_on_rsvp", "TRUE", "TRUE emails you a line for every RSVP"],
    ["rsvp_whatsapp", "+918943503045", "Number the WhatsApp RSVP fallback goes to (+91…)"],
    ["hero_date_full", "16 & 19 December 2026 · Kozhikode", "Date line under the names, main link (text after the last · goes on its own line)"],
    ["hero_date_reception", "Saturday, 19 December 2026 · K-Hills, Ramanattukara", "Date line under the names, reception link"],
    ["full_intro", "Together with their families, **Anusha & Saurav** joyfully invite you to celebrate their wedding and reception. Your presence and blessings will make our celebrations complete.", "Invitation text, main link. **double stars** make text bold"],
    ["reception_greeting", "Dear {name}, you are warmly invited to our reception", "{name} becomes the ?to=Name in the link, or 'guest'"],
    ["reception_intro", "Our wedding will be solemnised in an intimate ceremony with close family on Wednesday, 16 December 2026. We would be delighted to have you join us as we celebrate at our reception.", "Invitation text, reception link"],
    ["sharing_the_happiness", "Swathi, Rajeesh, Dheerav, Athul, Babna, Hridya, friends & relatives", "Names in the footer"],
    ["thank_you", "Thank you for celebrating with us", "Replaces the countdown once the event has started"],
    ["footer_date", "16 · 19 · XII · MMXXVI · Kozhikode", "Small line at the very bottom"],
    ["image_hero", "", "Optional: path or link of a replacement hero illustration (blank = assets/img/couple/painted-standing.jpg)"],
    ["image_namaste", "", "Optional: path or link of a replacement namaste illustration (blank = assets/img/couple/painted-namaste.jpg)"],
    ["image_back", "", "Optional: path or link of a replacement back illustration (blank = assets/img/couple/painted-back.jpg)"]
  ],
  events: [
    ["wedding", "Wedding (Muhurtham)", "വിവാഹം · മുഹൂർത്തം", "Wednesday, 16 December 2026", "10:00 – 10:30 AM", "2026-12-16T10:00:00+05:30", "2026-12-16T10:30:00+05:30", "Staydium Bungalow Resort", "Bilathikkulam Road, West Nadakkave, Kozhikode", "https://maps.app.goo.gl/2Gvrd5njGAx9Ak2M8", "full", "1"],
    ["reception", "Reception", "സ്വീകരണം", "Saturday, 19 December 2026", "5:00 – 9:00 PM", "2026-12-19T17:00:00+05:30", "2026-12-19T21:00:00+05:30", "K-Hills Resorts & Spa", "Ramanattukara – Farook College Road, Kozhikode", "https://maps.app.goo.gl/9MCcY8Ca2BPpSmAp7", "full,reception", "2"]
  ],
  contacts: [
    ["Saurav Krishna", "Groom", "+918943503045", "TRUE", "1", "TRUE"],
    ["Athul T K", "Bride’s brother", "+918547977436", "TRUE", "2", "TRUE"],
    ["Adv. P. Viswanathan", "Groom’s father", "+919447337236", "TRUE", "3", "TRUE"],
    ["Shri. Anilkumar Thattarkandy", "Bride’s father", "+919387685078", "TRUE", "4", "TRUE"]
  ],
  families: [
    ["bride_parents", "Shri. Anilkumar Thattarkandy & Smt. Beena Tharol"],
    ["bride_house", "“Swapnam”, Thattarkandy, Chungam, Westhill"],
    ["groom_parents", "Adv. P. Viswanathan & Late Santha T"],
    ["groom_house", "Krishna House, Annassery PO"]
  ]
};


// =====================================================================================
// One-time setup
// =====================================================================================

function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  var created = [];

  ensureTab_(ss, TAB.settings, HEAD.Settings, SEED.settings, true, [190, 520, 360], created);
  ensureTab_(ss, TAB.events, HEAD.Events, SEED.events, true, [90, 150, 150, 200, 120, 200, 200, 190, 280, 260, 110, 60], created);
  ensureTab_(ss, TAB.contacts, HEAD.Contacts, SEED.contacts, true, [230, 150, 150, 90, 60, 70], created);
  ensureTab_(ss, TAB.families, HEAD.Families, SEED.families, true, [150, 460], created);
  ensureTab_(ss, TAB.rsvp, HEAD.RSVP, [], false, [140, 80, 120, 180, 130, 80, 70, 80, 60, 110, 320, 200], created);
  ensureTab_(ss, TAB.uploads, HEAD.Uploads, [], false, [140, 160, 320, 260, 160], created);
  if (!ss.getSheetByName(TAB.summary)) { ss.insertSheet(TAB.summary); created.push(TAB.summary); }
  ss.getSheetByName(TAB.rsvp).getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  ss.getSheetByName(TAB.uploads).getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');

  // Remove the empty starter tab Google adds to a new spreadsheet.
  ['Sheet1', 'Sheet 1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  // Put the tabs in a sensible order.
  [TAB.settings, TAB.events, TAB.contacts, TAB.families, TAB.rsvp, TAB.summary, TAB.uploads].forEach(function (n, i) {
    ss.setActiveSheet(ss.getSheetByName(n));
    ss.moveActiveSheet(i + 1);
  });
  ss.setActiveSheet(ss.getSheetByName(TAB.settings));

  var f = ensureFolders_();
  rebuildSummary_();
  clearAllCache_();

  var msg = 'Setup done. ' + (created.length ? 'Created tabs: ' + created.join(', ') + '. ' : 'All tabs already existed (left as they were). ') +
    'Drive folder: "' + f.root.getName() + '". ' +
    (PropertiesService.getScriptProperties().getProperty('UPLOAD_PASSCODE') ? 'Upload passcode is set.' : 'Next: set UPLOAD_PASSCODE in Project Settings → Script properties.');
  console.log(msg);
  try { ss.toast(msg, 'Wedding site', 10); } catch (e) {}
  return msg;
}

// Creates a tab with a header row and starting rows, only if the tab is empty.
function ensureTab_(ss, name, head, rows, plainText, widths, created) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() > 0) return sh;   // never overwrite existing content
  if (plainText) {
    // Plain-text cells, so Sheets doesn't turn dates, times or +91 numbers into something else.
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  }
  sh.getRange(1, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setBackground('#F3EBD8').setFontColor('#7A1F2B');
  sh.setFrozenRows(1);
  if (rows && rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows).setVerticalAlignment('top');
  (widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (name === TAB.settings || name === TAB.families) sh.getRange(1, 2, sh.getMaxRows(), 1).setWrap(true);
  created.push(name);
  return sh;
}

function ensureFolders_() {
  var props = PropertiesService.getScriptProperties();
  function byProp(key) {
    var id = props.getProperty(key);
    if (!id) return null;
    try { var f = DriveApp.getFolderById(id); return f.isTrashed() ? null : f; } catch (e) { return null; }
  }
  function child(parent, key, name) {
    var f = byProp(key);
    if (!f) {
      var it = parent.getFoldersByName(name);
      f = it.hasNext() ? it.next() : parent.createFolder(name);
      props.setProperty(key, f.getId());
    }
    return f;
  }
  var root = byProp(FOLDER_PROP.root);
  if (!root) {
    var it = DriveApp.getRootFolder().getFoldersByName(ROOT_FOLDER_NAME);
    root = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
    props.setProperty(FOLDER_PROP.root, root.getId());
  }
  var pending = child(root, FOLDER_PROP.pending, 'Pending uploads');
  var approved = child(root, FOLDER_PROP.approved, 'Approved');
  approved.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  ALBUMS.forEach(function (a) { child(approved, FOLDER_PROP[a], a); });
  return { root: root, pending: pending, approved: approved };
}

function folder_(key) {
  var id = PropertiesService.getScriptProperties().getProperty(FOLDER_PROP[key]);
  if (!id) throw new Error('Folders are missing: run setup() first.');
  return DriveApp.getFolderById(id);
}


// =====================================================================================
// Sheet menu
// =====================================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wedding site')
    .addItem('Refresh site cache', 'menuRefreshCache')
    .addItem('Rebuild summary', 'menuRebuildSummary')
    .addSeparator()
    .addItem('Approve selected uploads', 'menuApproveUploads')
    .addToUi();
}

// Edits to the public tabs reach the site straight away instead of after 5 minutes.
function onEdit(e) {
  try {
    var name = e && e.range && e.range.getSheet().getName();
    if (PUBLIC_TABS.indexOf(name) >= 0) clearConfigCache_();
  } catch (err) { /* simple triggers may not have access; the 5-minute cache still expires */ }
}

function menuRefreshCache() {
  clearAllCache_();
  var fixed = shareApprovedPhotos_();
  SpreadsheetApp.getActive().toast('The site will show the latest Sheet content and photos now.' +
    (fixed ? ' (' + fixed + ' photo(s) made viewable for the gallery.)' : ''), 'Wedding site', 6);
}

function menuRebuildSummary() {
  var t = rebuildSummary_();
  SpreadsheetApp.getActive().toast('Summary updated: ' + t.responses + ' response(s).', 'Wedding site', 5);
}

function menuApproveUploads() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== TAB.uploads) {
    ui.alert('Open the Uploads tab, select the rows of the photos to approve, then choose this again.');
    return;
  }
  var rows = selectedRows_(sh);
  if (!rows.length) { ui.alert('Select one or more photo rows in the Uploads tab first (not the header).'); return; }

  var r = ui.prompt('Approve ' + rows.length + ' photo(s)',
    'Which gallery album should they go to?\n\n1 = Save the Date\n2 = Wedding\n3 = Reception', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var album = ALBUMS[Number(String(r.getResponseText()).trim()) - 1];
  if (!album) { ui.alert('Please type 1, 2 or 3.'); return; }

  var dest = folder_(album), moved = 0, problems = 0;
  rows.forEach(function (n) {
    var id = String(sh.getRange(n, 4).getValue()).trim();
    if (!id) { problems++; return; }
    try {
      var file = DriveApp.getFileById(id);
      file.moveTo(dest);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      sh.getRange(n, 5).setValue('approved: ' + album);
      moved++;
    } catch (e) {
      sh.getRange(n, 5).setValue('error: ' + e.message);
      problems++;
    }
  });
  clearGalleryCache_();
  ui.alert(moved + ' photo(s) moved to "' + album + '".' + (problems ? ' ' + problems + ' could not be moved (see the status column).' : '') +
    (isTrue_(setting_('gallery_enabled', 'FALSE')) ? '' : '\n\nThe gallery is still hidden on the site: set gallery_enabled to TRUE in Settings when you are ready.'));
}

function selectedRows_(sh) {
  var seen = {}, out = [];
  var list = sh.getActiveRangeList();
  (list ? list.getRanges() : [sh.getActiveRange()]).forEach(function (rg) {
    for (var r = rg.getRow(); r <= rg.getLastRow(); r++) {
      if (r >= 2 && r <= sh.getLastRow() && !seen[r]) { seen[r] = true; out.push(r); }
    }
  });
  return out;
}

// Files dropped straight into the Approved album folders need link-viewing for the gallery.
function shareApprovedPhotos_() {
  var fixed = 0;
  ALBUMS.forEach(function (a) {
    var it = folder_(a).getFiles();
    while (it.hasNext()) {
      var f = it.next();
      try {
        if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
          f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          fixed++;
        }
      } catch (e) { console.warn('Could not share ' + f.getName() + ': ' + e); }
    }
  });
  return fixed;
}


// =====================================================================================
// Web app: GET
// =====================================================================================

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'config') {
      var variant = p.variant === 'reception' ? 'reception' : 'full';
      return json_(cached_('config:' + variant, function () { return buildConfig_(variant); }));
    }
    if (p.action === 'gallery') return json_(cached_('gallery', buildGallery_));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

// Reads a tab as display text (so nothing turns into a Date or number by accident).
function table_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  var head = v[0].map(function (h) { return String(h).trim(); });
  return v.slice(1).map(function (row) {
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = String(row[i]).trim(); });
    return o;
  });
}

function buildConfig_(variant) {
  var settings = {};
  table_(TAB.settings).forEach(function (r) { if (r.key && r.value !== '') settings[r.key] = r.value; });

  var events = table_(TAB.events).filter(function (e) {
    if (!e.id) return false;
    if (variant !== 'reception') return true;
    // The reception page never receives wedding details.
    return String(e.variants).split(',').map(function (s) { return s.trim(); }).indexOf('reception') >= 0;
  });

  var contacts = table_(TAB.contacts).filter(function (c) {
    return c.name && String(c.visible).toUpperCase() !== 'FALSE';
  });

  var families = {};
  table_(TAB.families).forEach(function (r) { if (r.key) families[r.key] = r.text; });

  return { ok: true, settings: settings, events: events, contacts: contacts, families: families };
}

function buildGallery_() {
  var out = { ok: true };
  ALBUMS.forEach(function (a) {
    var list = [], it = folder_(a).getFiles();
    while (it.hasNext()) {
      var f = it.next();
      if (f.isTrashed() || !/^image\//.test(f.getMimeType())) continue;
      list.push({ id: f.getId(), sortKey: f.getName() });
    }
    // Sorted by file name; names are not sent (uploaded files carry the uploader's name).
    list.sort(function (x, y) { return x.sortKey.localeCompare(y.sortKey); });
    out[a] = list.map(function (x) { return { id: x.id }; });
  });
  return out;
}


// =====================================================================================
// Web app: POST
// =====================================================================================

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    if (body && body.type === 'rsvp') return json_(handleRsvp_(body));
    if (body && body.type === 'upload') return json_(handleUpload_(body));
    return json_({ ok: false, error: 'unknown_type' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function handleRsvp_(b) {
  if (b.website) return { ok: true };   // honeypot filled in: a bot. Pretend it worked.
  if (!isTrue_(setting_('rsvp_open', 'TRUE'))) return { ok: false, error: 'closed' };

  var variant = b.variant === 'reception' ? 'reception' : 'full';
  var name = clean_(b.name, 80);
  if (name.length < 2) return { ok: false, error: 'name_required' };
  if (b.attending !== 'yes' && b.attending !== 'no') return { ok: false, error: 'attending_required' };
  var yes = b.attending === 'yes';
  var wedding = yes && variant === 'full' && b.wedding === true;
  var reception = yes && (variant === 'reception' || b.reception === true);
  if (yes && !wedding && !reception) return { ok: false, error: 'pick_an_event' };
  var guests = yes ? Math.max(1, Math.min(10, Math.round(Number(b.guests) || 1))) : 0;
  var food = reception && FOOD.indexOf(b.food) >= 0 ? b.food : '';
  var device = clean_(b.device_id, 64) || 'no-id-' + Utilities.getUuid();

  var row = [
    new Date(), variant, text_(device), text_(name), text_(clean_(b.phone, 20)),
    yes ? 'Accept' : 'Decline', wedding ? 'Yes' : 'No', reception ? 'Yes' : 'No',
    guests, food, text_(clean_(b.message, 500, true)), text_(clean_(b.user_agent, 200))
  ];

  var totals;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    SpreadsheetApp.getActive().getSheetByName(TAB.rsvp).appendRow(row);
    totals = rebuildSummary_();
  } finally {
    lock.releaseLock();
  }

  if (isTrue_(setting_('notify_email_on_rsvp', 'TRUE'))) {
    try {
      var what = yes
        ? 'accepts · ' + [wedding ? 'Wedding' : '', reception ? 'Reception' : ''].filter(String).join(' & ') +
          ' · ' + guests + (guests > 1 ? ' guests' : ' guest') + (food ? ' · ' + food : '')
        : 'declines';
      MailApp.sendEmail({
        to: Session.getEffectiveUser().getEmail(),
        subject: 'RSVP: ' + name + ' ' + what,
        body: name + ' ' + what + (b.message ? '\n\n"' + clean_(b.message, 500, true) + '"' : '') +
          '\n\nTotals so far: wedding ' + totals.weddingGuests + ', reception ' + totals.receptionGuests +
          ', declined ' + totals.declined + ' (' + totals.responses + ' responses).\n\nOpen the Sheet for details: ' +
          SpreadsheetApp.getActive().getUrl()
      });
    } catch (err) { console.warn('Email not sent: ' + err); }
  }
  return { ok: true };
}

function handleUpload_(b) {
  var props = PropertiesService.getScriptProperties();
  var code = props.getProperty('UPLOAD_PASSCODE');
  if (!code) return { ok: false, error: 'uploads_closed' };

  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('upload_fails') || 0);
  if (fails >= MAX_PASSCODE_FAILS) return { ok: false, error: 'too_many_attempts' };
  if (String(b.passcode || '').trim() !== String(code).trim()) {
    cache.put('upload_fails', String(fails + 1), 600);
    return { ok: false, error: 'bad_passcode' };
  }

  var uploader = clean_(b.uploader, 60);
  if (uploader.length < 2) return { ok: false, error: 'name_required' };
  var files = Array.isArray(b.files) ? b.files : [];
  if (!files.length) return { ok: false, error: 'no_files' };
  if (files.length > MAX_FILES) return { ok: false, error: 'too_many_files' };

  var pending = folder_('pending');
  var log = SpreadsheetApp.getActive().getSheetByName(TAB.uploads);
  var stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd_HHmm');
  var who = safeName_(uploader, 40).replace(/\s+/g, '-');
  var saved = 0, skipped = 0;

  files.forEach(function (f) {
    var mime = String((f && f.mime) || '').toLowerCase();
    if (!OK_MIME.test(mime) || !f.base64) { skipped++; return; }
    var bytes;
    try { bytes = Utilities.base64Decode(String(f.base64)); } catch (err) { skipped++; return; }
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) { skipped++; return; }
    var original = safeName_(f.name || 'photo', 80) || 'photo';
    var fileName = stamp + '_' + who + '_' + original;
    var file = pending.createFile(Utilities.newBlob(bytes, mime, fileName));
    log.appendRow([new Date(), text_(uploader), text_(fileName), file.getId(), 'pending']);
    saved++;
  });

  if (!saved) return { ok: false, error: 'no_valid_photos' };
  return { ok: true, saved: saved, skipped: skipped };
}


// =====================================================================================
// Summary tab (rebuilt after every RSVP; counts only each device's latest answer)
// =====================================================================================

function rebuildSummary_() {
  var ss = SpreadsheetApp.getActive();
  var rs = ss.getSheetByName(TAB.rsvp);
  var rows = rs && rs.getLastRow() > 1 ? rs.getRange(2, 1, rs.getLastRow() - 1, HEAD.RSVP.length).getValues() : [];

  // Latest row per device_id, in order of their latest answer.
  var latest = {}, order = [];
  rows.forEach(function (r, i) {
    var id = String(r[2]) || 'row-' + i;
    if (latest[id]) order.splice(order.indexOf(id), 1);
    latest[id] = r;
    order.push(id);
  });
  var list = order.map(function (id) { return latest[id]; });

  var t = { responses: list.length, accepted: 0, declined: 0, weddingGuests: 0, receptionGuests: 0,
            veg: 0, nonveg: 0, nopref: 0, unsaid: 0, viaFull: 0, viaReception: 0 };
  list.forEach(function (r) {
    var g = Number(r[8]) || 0;
    if (r[1] === 'reception') t.viaReception++; else t.viaFull++;
    if (r[5] !== 'Accept') { t.declined++; return; }
    t.accepted++;
    if (r[6] === 'Yes') t.weddingGuests += g;
    if (r[7] === 'Yes') {
      t.receptionGuests += g;
      if (r[9] === 'Veg') t.veg += g;
      else if (r[9] === 'Non-veg') t.nonveg += g;
      else if (r[9] === 'No preference') t.nopref += g;
      else t.unsaid += g;
    }
  });

  var sh = ss.getSheetByName(TAB.summary) || ss.insertSheet(TAB.summary);
  sh.clear();
  var top = [
    ['RSVP summary', ''],
    ['Updated', Utilities.formatDate(new Date(), TZ, 'd MMM yyyy, h:mm a')],
    ['', ''],
    ['Wedding (16 Dec) · guests coming', t.weddingGuests],
    ['Reception (19 Dec) · guests coming', t.receptionGuests],
    ['   Reception food · Veg (guests)', t.veg],
    ['   Reception food · Non-veg (guests)', t.nonveg],
    ['   Reception food · No preference (guests)', t.nopref],
    ['   Reception food · Not said (guests)', t.unsaid],
    ['Responses that accepted', t.accepted],
    ['Responses that declined', t.declined],
    ['All responses', t.responses],
    ['   from the main link', t.viaFull],
    ['   from the reception link', t.viaReception],
    ['', ''],
    ['Counts use only the latest answer from each phone/browser (a changed response replaces the earlier one).', '']
  ];
  sh.getRange(1, 1, top.length, 2).setValues(top);
  sh.getRange('A1').setFontSize(14).setFontWeight('bold').setFontColor('#7A1F2B');
  sh.getRange('A4:B5').setFontWeight('bold');
  sh.getRange('A16').setFontStyle('italic').setFontColor('#66584A');

  var startRow = top.length + 2;
  var head = ['Latest answer per guest', 'Attending', 'Wedding', 'Reception', 'Guests', 'Food', 'Phone', 'Blessings', 'Link', 'Answered at'];
  var body = list.slice().reverse().map(function (r) {
    // Guest-typed text goes back in as plain text (see text_).
    return [text_(String(r[3])), r[5], r[6], r[7], r[8], r[9], text_(String(r[4])), text_(String(r[11])), r[1], r[0]];
  });
  sh.getRange(startRow, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#F3EBD8');
  if (body.length) {
    sh.getRange(startRow + 1, 1, body.length, head.length).setValues(body).setVerticalAlignment('top');
    sh.getRange(startRow + 1, 10, body.length, 1).setNumberFormat('d MMM, h:mm am/pm');
  }
  sh.setColumnWidth(1, 300);
  sh.setColumnWidths(2, 5, 90);
  sh.setColumnWidth(7, 130);
  sh.setColumnWidth(8, 320);
  sh.setFrozenRows(0);
  return t;
}


// =====================================================================================
// Helpers
// =====================================================================================

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function cached_(key, build) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var value = build();
  var s = JSON.stringify(value);
  if (s.length < 90000) cache.put(key, s, CACHE_SECONDS);
  return value;
}
function clearConfigCache_() { CacheService.getScriptCache().removeAll(['config:full', 'config:reception']); }
function clearGalleryCache_() { CacheService.getScriptCache().remove('gallery'); }
function clearAllCache_() { CacheService.getScriptCache().removeAll(['config:full', 'config:reception', 'gallery']); }

function setting_(key, fallback) {
  var rows = table_(TAB.settings);
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return fallback;
}
function isTrue_(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }

// Trim, drop control characters, cap the length.
function clean_(v, max, multiline) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}
// Store guest-typed text as plain text: the leading apostrophe stops Sheets from treating
// "=…", "+91…" etc. as a formula or a number. The apostrophe itself is not shown.
function text_(s) { return s ? "'" + s : ''; }
function safeName_(s, max) {
  return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, max);
}
