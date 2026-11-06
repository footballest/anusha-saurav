# CLAUDE.md — Anusha & Saurav · Kerala Wedding Invitation Website

This file is the build brief for this repository. Read all of it before writing code.
The owner is **Saurav Krishna** (the groom). He is comfortable with tech but is not a
full-time web developer, so explain what you are doing in plain words, keep changes
small, and stop at the checkpoints listed under **Build phases**.

---

## 1. What we are building

A single, mobile-first **digital wedding invitation** website for a **Kerala Hindu
wedding**, hosted free on **GitHub Pages**, shared with guests as a WhatsApp link.
It is inspired by https://deepanks.github.io/kanika-deepankar/ (an opening "Open
Invitation" screen, blessing, couple and parents, live countdown, events, venue with
directions, RSVP form, contacts with call/WhatsApp, downloadable PDF), but it must
look and feel **distinctly Kerala**, not North Indian.

There are **two versions of the site**, built from one shared codebase:

| Version | URL path | Audience | Shows |
|---|---|---|---|
| **Full** (default, main link) | `/` | ~250–300 guests | Wedding (muhurtham) **and** reception |
| **Reception** | `/reception/` | ~900 guests | Reception only: a greeting "Dear guest, you are warmly invited to our reception" (optionally personalised with `?to=Name`), plus one gentle line that the wedding is a private family ceremony |

*Decision (6 Nov 2026):* the main link is the full invitation; reception-only moved to
`/reception/`; `/muhurtham/` is not used. One shared `data/fallback.json` is fine —
Saurav does not mind the wedding details being in the data file; the Reception page
simply never renders them.

Plus two unlisted pages:

| Page | URL path | Purpose |
|---|---|---|
| Photo upload | `/upload/` | Passcode-protected upload for close friends; never linked from the site |
| Print | `/print/` | Print-optimised layout used only to generate the PDFs |

Backend: a **Google Sheet + Google Apps Script web app** owned by Saurav's Google
account. It (a) serves editable site details as JSON, (b) receives RSVPs,
(c) receives photo uploads into Google Drive, (d) lists approved photos for the gallery.

### Hard constraints
- Static site only: plain **HTML + CSS + vanilla JavaScript**. No framework, no build
  step required to deploy. GitHub Pages serves the repo root from `main`.
- Node scripts are allowed **only** for local asset generation (PDF, OG images, QR
  codes) under `scripts/`; their outputs are committed.
- Mobile first: design at **375px** wide, then scale up. No horizontal scroll.
- First load under ~1.5 MB. Lazy-load everything below the fold.
- Every page has `<meta name="robots" content="noindex, nofollow">`; add `robots.txt`
  disallowing all. The site is public by link but should not be in search results.
- No third-party trackers or analytics. Do not use api.qrserver.com or similar —
  generate QR codes locally.
- Respect `prefers-reduced-motion`.
- **Never** commit secrets (upload passcode) or personal reference photos. Personal
  photos live in `reference/` which is in `.gitignore`.
- Ask Saurav before: creating the GitHub repo, pushing, enabling Pages, or anything
  irreversible.

---

## 2. Content (source of truth until the Sheet is live)

Put all of this in `data/fallback.json`. The site renders from this file instantly,
then refreshes from the Apps Script endpoint if it is configured and reachable.

### Couple
- Bride: **Anusha T K**
- Groom: **Saurav Krishna**
- Short form for headings: **Anusha & Saurav**

### Families (both families are hosts — do not phrase it as "from the bride's side")
- Bride: *daughter of* **Shri. Anilkumar Thattarkandy & Smt. Beena Tharol**,
  "Swapnam", Thattarkandy, Chungam, Westhill
- *Decision (6 Nov 2026):* grandparents are **not** listed on the invitation (either side).
- Groom: *son of* **Adv. P. Viswanathan & Late Santha T**,
  Krishna House, Annassery PO
- House/address lines are controlled by a setting `show_addresses` (default **false**).
- Closing line ("Sharing the happiness"): **Swathi, Rajeesh, Dheerav, Athul, Babna, Hridya, friends & relatives**
  *(updated 7 Nov 2026 — Swathi, Rajeesh, Dheerav added first; this order)*

### Events
| id | Name | Malayalam label | Date | Time (IST) | Venue | Address | Map |
|---|---|---|---|---|---|---|---|
| `wedding` | Wedding (Muhurtham) | വിവാഹം · മുഹൂർത്തം | Wednesday, 16 December 2026 | 10:00–10:30 AM | Staydium Bungalow Resort | Bilathikkulam Road, West Nadakkave, Kozhikode | https://maps.app.goo.gl/2Gvrd5njGAx9Ak2M8 |
| `reception` | Reception | സ്വീകരണം | Saturday, 19 December 2026 | 5:00–9:00 PM | K-Hills Resorts & Spa | Ramanattukara – Farook College Road, Kozhikode | https://maps.app.goo.gl/9MCcY8Ca2BPpSmAp7 |

Notes:
- "Staydium" is the correct spelling of the venue name. Do not "fix" it.
- `wedding` appears only on the Full version. `reception` appears on both.
- Use ISO times with `+05:30` internally (e.g. `2026-12-16T10:00:00+05:30`).

### Contacts (shown in this order; each with Call and WhatsApp buttons)
| Name | Relation | Phone |
|---|---|---|
| Saurav Krishna | Groom | +91 89435 03045 |
| Athul T K | Bride's brother | +91 85479 77436 |
| Adv. P. Viswanathan | Groom's father | +91 94473 37236 |
| Shri. Anilkumar Thattarkandy | Bride's father | +91 93876 85078 |

`tel:` links use `+918943503045` format; WhatsApp links use `https://wa.me/918943503045`.

### Key wording
- Top invocation (both versions): **॥ ശ്രീ മഹാഗണപതയേ നമഃ ॥** with a small line-art
  Ganapathi (the owner's card used one; draw a simple original SVG, not a copied image).
- Full version intro:
  > Together with their families, **Anusha & Saurav** joyfully invite you to
  > celebrate their wedding and reception. Your presence and blessings will make our
  > celebrations complete.
- Reception version intro:
  > Our wedding will be solemnised in an intimate ceremony with close family on
  > Wednesday, 16 December 2026. We would be delighted to have you join us as we
  > celebrate at our reception.
- Countdown target: Full → wedding muhurtham; Reception → reception start.
  After the event starts, replace the countdown with "Thank you for celebrating with us".

Show all wording to Saurav for approval in Phase 1; family may tweak it.

---

## 3. Design direction — Kerala, elegant and cute

### Mood
Kasavu saree off-white with gold zari, brass nilavilakku glow, jasmine (mullappoo)
strings, banana leaves, lotus, a tharavadu (traditional Kerala house) roofline with
wooden doors, coconut palms. Elegant like a temple-wedding morning, with the cute
couple caricatures adding warmth.

### Explicitly avoid (North Indian / generic)
Marigold torans, mehendi patterns, Rajasthani jharokha arches, Devanagari script,
shehnai/doli imagery, heavy maroon-and-gold "royal" Mughal styling, glitter.

### Palette — four themes (decision, 6 Nov 2026)
The first cream-on-cream look read as dull. Redesigned so an ivory **paper column**
(gold double hairline frame with a tharavadu-gable top) sits on a **coloured, softly
patterned page**. Colours are CSS tokens per theme in `assets/css/site.css`
(`html[data-theme=…]`); every rule uses the tokens only.

| Theme key | Page | Paper | Titles | Feel |
|---|---|---|---|---|
| `green` (**chosen**) | #1F3B2D banana-leaf green | #FFFDF7 | #7A1F2B maroon | Temple Green |
| `kasavu` | #FFFFFF | #FFFFFF | #7A1F2B | Kasavu White & Gold |
| `lotus` | #F2DFDB blush | #FFFAF8 | #7E2A44 plum | Lotus Blush |
| `maroon` | #5E1424 | #FFFBF4 | #6E1526 | Kumkum Maroon |

Gold hairlines #C9A24A / #C49A3A, leaf green #2F5D3A, ink #33261A, muted #66584A.
Choose the theme with `settings.theme` (data / Sheet), or `?theme=<key>` in the URL.
`?themes` in the URL shows a swatch picker for previewing (never linked for guests).
*Decision (6 Nov 2026):* Saurav chose **Temple Green** (`green`). The other three themes
stay in the CSS as alternatives; `?themes` still shows the preview picker.
Set `color-scheme: light` and explicit backgrounds so dark-mode phones do not invert it.

### Type (Google Fonts) — updated 6 Nov 2026
- Names, section and event titles: **Great Vibes** (script)
- Small spaced capital labels, dates, buttons: **Cinzel**
- Body: **EB Garamond**
- Malayalam: **Manjari** for labels and the invocation
- (Cormorant Garamond and Marcellus were dropped in the redesign.)
- Load only the weights used; `font-display: swap`.

### Motifs to build as inline SVG (original drawings, in `assets/img/`)
1. **Kasavu border** — a repeating horizontal band (ivory, thick gold stripe, thin gold
   stripe, hairline green) used as section dividers and the page frame edges.
2. **Nilavilakku** (brass lamp) with flames that can animate (flicker, light up).
3. **Jasmine string** hanging from the top corners.
4. **Banana leaf + lotus** corner pieces.
5. **Tharavadu doors** for the opening screen.
6. **Ganapathi line-art** for the invocation.
7. **Venue vignettes** — a simple bungalow for Staydium, a resort with palms for K-Hills.

### Couple illustrations
*Decision (6 Nov 2026):* all three poses use Saurav's **personalised painted
illustrations**, approved by him for the public site:

| Slot | Web file (committed) | Original (private, in `reference/`) |
|---|---|---|
| `hero` | `assets/img/couple/painted-standing.jpg` | `couple-illustration-chatgpt.png` |
| `namaste` | `assets/img/couple/painted-namaste.jpg` | `couple-namaste-chatgpt.webp` |
| `back` | `assets/img/couple/painted-back.jpg` | `couple-back-chatgpt.webp` |

Web files are 733×1100 JPEGs, **white-balanced so the painted backdrop is pure white**
(each original had a slightly different cream). CSS then blends any `.jpg` couple image
into the paper with `mix-blend-mode: multiply` plus feathered edges. For this to work,
sections inside `#app` must not create their own stacking layer (no `z-index`, no
`isolation`). When replacing a painting, white-balance it the same way first.
The generic cute SVGs (`hero.svg`, `namaste.svg`, `back.svg`) remain as fallbacks.

Original brief (kept for reference):
Saurav wants to **start with generic, stylised couple illustrations** (like the decorative
art on the reference site) and replace them with personalised ones later. So:

- Draw an original, elegant **stylised Kerala bride and groom** as SVG, in the same
  flat style as the other motifs. They are generic: simple or faceless features, no
  attempt at likeness. Throughout this file, "caricature" means these illustrations.
- Groom: cream kurta with mandarin collar, cream mundu with gold kasavu border.
  Bride: red silk saree with gold zari and a thin green border, pallu over her left
  shoulder, long curly black hair, jasmine in her hair. The groom is about a head taller.
- Three poses, each its own file:
  - `assets/img/couple/hero.svg`: standing together, turned slightly toward each other
  - `assets/img/couple/namaste.svg`: both with folded hands (footer, opening screen)
  - `assets/img/couple/back.svg`: backs to the viewer, heads turned to look at each
    other, holding hands (closing "See you there!" and RSVP thank-you)
- **Make swapping easy.** Reference these files only through an `images` block in
  `data/fallback.json` (and a matching `image_hero` / `image_namaste` / `image_back` row in
  the Settings tab). Replacing an illustration later must mean dropping in a new file
  (SVG or transparent PNG/WebP) and changing one path, with no code changes. Layouts must
  work for both an SVG and a PNG of a different aspect ratio (`object-fit: contain`).
- A gentle fade/rise on scroll is enough; no blink or limb animation, so PNGs work the same.
- Future options, not for now: `assets/img/couple-caricature-v1.svg` (an early hand-made
  sketch) and AI-made illustrations Saurav may add to `reference/`. Do not use either
  unless he asks.

### Opening screen
Full-screen ivory with kasavu frame, couple initials "A ❀ S", "You are cordially
invited", and a button **Open Invitation**. On tap: the nilavilakku wicks light one by
one, then the tharavadu doors swing open to reveal the hero. Under 2.5 s total;
skippable; reduced-motion users get a simple fade. The tap also unlocks audio (see
Music) but music stays off unless they press play.

---

## 4. Page structure (both versions share these sections; data decides what shows)

1. **Opening screen** (above)
2. **Hero** — invocation, Ganapathi line-art, caricature couple, names, date line:
   - Full: "16 & 19 December 2026 · Kozhikode"
   - Reception: "Saturday, 19 December 2026 · K-Hills, Ramanattukara"
3. **Invitation** — version-specific intro, then both families' parents (no
   grandparents). Reception version opens this with the "Dear guest…" greeting.
4. **Countdown** — days/hours/mins/secs, gold numerals on ivory cards.
5. **Events** — one card per event in this version: Malayalam label above English
   name, date, time, venue; buttons **Directions** and **Add to calendar**
   (`.ics` download generated client-side + a Google Calendar link).
6. **Venues** — vignette illustration, address, Google Maps button. (Do not embed
   Google Maps iframes; they are heavy. Link out instead.)
7. **RSVP** — see section 6.
8. **Gallery** — hidden until `gallery_enabled` is true. Tabs: Save the Date ·
   Wedding · Reception. Lightbox on tap.
9. **Contacts** — the four contacts with Call / WhatsApp.
10. **Closing** — "See you there!" with the back-view couple illustration (added in Phase 3).
11. **Footer** — "Sharing the happiness: Swathi, Rajeesh, Dheerav, Athul, Babna, Hridya, friends & relatives",
    PDF download button (version-specific), QR code to this version's URL,
    small namaste couple illustration, "16 · 19 · XII · MMXXVI · Kozhikode".
12. **Floating controls** — music toggle (bottom-right) and a floating bottom nav pill with icons
    (Events · Venue · RSVP · Contact) that appears after scrolling past the hero.

---

## 5. Repository layout

```
/
├── CLAUDE.md
├── index.html                 # Full version (default, main link)
├── reception/index.html       # Reception-only version
├── upload/index.html          # Passcode upload page (unlisted, noindex)
├── print/index.html           # Print layout, ?v=full|reception
├── robots.txt
├── .gitignore                 # node_modules, reference/, .env, .DS_Store
├── assets/
│   ├── css/site.css
│   ├── js/
│   │   ├── config.js          # VARIANT is set per page; API_URL constant
│   │   ├── data.js            # load fallback.json, then refresh from API, cache in localStorage
│   │   ├── app.js             # render sections, countdown, opening animation, nav
│   │   ├── rsvp.js
│   │   ├── gallery.js
│   │   ├── calendar.js        # .ics + Google Calendar links
│   │   ├── music.js
│   │   └── upload.js
│   ├── img/                   # SVG motifs, caricatures, og images, qr codes
│   ├── audio/theme.mp3        # supplied by Saurav (royalty-free)
│   └── pdf/
│       ├── Anusha-Saurav-Reception-Invitation.pdf
│       └── Anusha-Saurav-Wedding-Invitation.pdf
├── data/fallback.json
├── apps-script/
│   ├── Code.gs                # pasted into the Google Sheet's Apps Script editor
│   └── README.md              # exact deploy steps for Saurav
├── scripts/
│   ├── make-qr.mjs            # QR SVGs for both URLs
│   ├── make-og.mjs            # 1200x630 preview images via Playwright
│   └── make-pdf.mjs           # PDFs from /print/ via Playwright
└── reference/                 # git-ignored personal photos
```

Each HTML page is a thin shell that sets its own `<title>`, meta description, Open
Graph and Twitter tags, and `window.VARIANT = "reception" | "full"`, then loads the
shared CSS/JS. **The Open Graph tags must be static in each HTML file** (WhatsApp does
not run JavaScript), so each version gets its own preview text and image:

- Reception: title "Anusha & Saurav · Reception Invitation", description
  "Saturday, 19 December 2026 · K-Hills Resorts & Spa, Ramanattukara. Tap to open your
  invitation & RSVP." Image `assets/img/og-reception.jpg`.
- Full: title "Anusha & Saurav · Wedding Invitation", description
  "Wedding 16 Dec · Reception 19 Dec 2026 · Kozhikode. Tap to open your invitation &
  RSVP." Image `assets/img/og-full.jpg`.
- Use absolute URLs in `og:image` and `og:url` (base URL in a single place you can
  change later, e.g. a constant documented at the top of each HTML file).

Base URL (until a custom domain or org is chosen):
`https://footballest.github.io/anusha-saurav/`

---

## 6. RSVP

Fields:
- Name (required)
- Phone (optional)
- Attending: **Joyfully accept** / **Regretfully decline**
- If accepting:
  - Full version: checkboxes **Wedding (16 Dec)** and **Reception (19 Dec)**, at least one
  - Reception version: reception is implied; no checkbox
  - Number of guests including you: stepper 1–10
  - Food preference for the reception (optional): Veg · Non-veg · No preference.
    Only show this if the reception is selected. (Wedding sadhya is vegetarian; no
    question needed for it.)
- Blessings for the couple (optional, max 500 chars)
- Hidden honeypot field for bots; reject if filled.

Behaviour:
- POST to the Apps Script URL with `Content-Type: text/plain` (avoids CORS preflight);
  body is JSON. Include `variant`, a random `device_id` stored in localStorage, and a
  timestamp.
- On success, show a thank-you card with the back-view couple illustration and "Change my
  response". Re-submissions append a new row with the same `device_id`; the Summary
  tab counts only the latest row per `device_id`.
- If the API is not configured or fails, show a friendly message and a WhatsApp
  fallback link to Saurav pre-filled with the RSVP text.
- Respect `rsvp_open` from settings (closed → show a polite note instead of the form).

---

## 7. Google Sheet + Apps Script backend

All in Saurav's Google account. `apps-script/Code.gs` must include a `setup()`
function that he runs once to create everything below.

### Sheet tabs
1. **Settings** (key | value | note) — public via the API. Keys at minimum:
   `couple_short`, `gallery_enabled` (FALSE), `rsvp_open` (TRUE), `music_enabled`
   (TRUE), `show_addresses` (FALSE), `notify_email_on_rsvp` (TRUE), `rsvp_whatsapp` (number for the WhatsApp fallback; Saurav),
   `reception_intro`, `reception_greeting`, `full_intro`, `sharing_the_happiness`.
2. **Events** — id | name_en | name_ml | date_label | start_iso | end_iso | venue |
   address | maps_url | variants (`full` or `full,reception`) | order
3. **Contacts** — name | relation | phone_e164 | whatsapp (TRUE/FALSE) | order | visible
4. **Families** — key | text (bride_parents, bride_house,
   groom_parents, groom_house)
5. **RSVP** — **private, never returned by the API**. timestamp | variant | device_id |
   name | phone | attending | wedding | reception | guests | food | message | user_agent
6. **Summary** — private. Latest-per-device totals: wedding headcount, reception
   headcount, veg / non-veg / no preference (reception), declines. Use formulas or have
   the script rebuild it on each RSVP.
7. **Uploads** — private log: timestamp | uploader_name | file_name | drive_file_id | status

`setup()` should also fill Settings/Events/Contacts/Families with the content from
section 2 so the Sheet starts complete.

### Drive folders (created by `setup()`, IDs saved in Script Properties)
```
Anusha-Saurav Wedding/
├── Pending uploads/        # guest uploads land here (private)
└── Approved/               # "Anyone with the link: Viewer"
    ├── Save the Date/
    ├── Wedding/
    └── Reception/
```

### Web app endpoints (Deploy → Web app, Execute as: Me, Who has access: Anyone)
- `GET ?action=config` → `{settings, events, contacts, families}` from the public tabs
  only. Cache with `CacheService` for 5 minutes; a menu item "Refresh site cache"
  clears it.
- `GET ?action=gallery` → `{ "Save the Date": [{id, name, w, h}], "Wedding": [...],
  "Reception": [...] }` listing files in the Approved subfolders. The site shows images
  via `https://drive.google.com/thumbnail?id=<ID>&sz=w1200` (and `sz=w400` for grids).
  Test this works; if Google blocks hotlinking, fall back to
  `https://lh3.googleusercontent.com/d/<ID>=w1200`.
- `POST` body `{type:"rsvp", ...}` → validate, append to RSVP, update Summary, optionally
  email Saurav (`MailApp`) a one-line notification.
- `POST` body `{type:"upload", passcode, uploader, files:[{name, mime, base64}]}` →
  check passcode against Script Property `UPLOAD_PASSCODE`; accept only
  `image/jpeg|png|webp|heic`; max 10 files per request; save to **Pending uploads** as
  `<date>_<uploader>_<original>`; log to Uploads tab.
- Always return JSON via `ContentService` with `{ok:true}` / `{ok:false,error}`.
- Never return the RSVP, Summary or Uploads tabs, the passcode, or folder IDs.

Add a custom menu in the Sheet: **Wedding site → Refresh site cache / Rebuild summary /
Approve selected uploads** (the last moves files listed in selected Uploads rows from
Pending into a chosen Approved subfolder and sets status = approved).

`apps-script/README.md` must give Saurav click-by-click steps: open Sheet → Extensions
→ Apps Script → paste → run `setup` → handle the "Google hasn't verified this app"
screen (Advanced → Go to project) → set `UPLOAD_PASSCODE` in Project Settings → Script
properties → Deploy → New deployment → Web app → copy URL → paste into
`assets/js/config.js`. Also: how to redeploy after code changes (Manage deployments →
Edit → New version, keeping the same URL).

---

## 8. Photo upload page (`/upload/`)

- Not linked anywhere on the site. noindex.
- Same Kerala styling, simpler layout: "Share your photos with Anusha & Saurav".
- Fields: your name, passcode, file picker (multiple, images only).
- Before upload, resize in the browser to max 2560px on the long edge, JPEG quality
  0.85, so files stay small; show per-file progress; upload in batches of 3.
- Clear message: "Photos are reviewed by the couple before appearing in the gallery."
- Mention limits: photos only, no videos.

---

## 9. Music

- Off by default. A floating round button with a small veena icon toggles play/pause.
- File `assets/audio/theme.mp3`, a royalty-free instrumental Saurav will supply
  (Pixabay Music or YouTube Audio Library). Never use film songs.
- Loop, volume 0.4, fade in/out over 1 s. Remember the choice in localStorage.
- Hidden entirely if the file is missing or `music_enabled` is false.

---

## 10. PDFs, QR codes, preview images

- `/print/?v=full|reception` renders a single portrait A5 page in the same Kerala style:
  invocation, couple caricature, names, families, the version's events with times and
  venues, contacts, QR code. No animations.
- `scripts/make-pdf.mjs` uses Playwright to print both versions to
  `assets/pdf/`. Filenames:
  `Anusha-Saurav-Wedding-Invitation.pdf` (full) and
  `Anusha-Saurav-Reception-Invitation.pdf` (reception).
- `scripts/make-qr.mjs` creates `assets/img/qr-full.svg` and `qr-reception.svg` in
  maroon on ivory using the `qrcode` npm package.
- `scripts/make-og.mjs` renders 1200×630 JPEGs for each version (caricature + names +
  date line on kasavu ivory), under 300 KB each.
- A `package.json` with scripts `qr`, `og`, `pdf`, `assets` (runs all three) and
  `serve` (local server). Only dev dependencies.

---

## 11. Quality bar and testing

- Test at 360, 375, 414 and 768 px widths and on desktop.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95.
- All text is real text (not baked into images) except the OG images and PDFs.
- Contrast: body text at least 4.5:1 on ivory.
- Buttons ≥ 44px tall; tap targets spaced.
- Images: SVG for illustrations, WebP/JPEG for photos, `loading="lazy"`.
- Check: both versions render correctly from `fallback.json` with the API URL empty;
  the Reception version never shows wedding venue/time anywhere in its HTML, the
  JavaScript-rendered page, its OG tags, its PDF or its `.ics`.
- Before calling a phase done, run the local server, take screenshots at 375px of every
  section of both versions, and show them to Saurav.

---

## 12. Build phases (stop and show Saurav at each ✅ checkpoint)

**Phase 1 — Skeleton and content**
Create the repo layout, `.gitignore`, `fallback.json`, both HTML shells, base CSS with
palette and fonts, all sections rendered with real content but minimal styling, the
countdown, and the version logic.
✅ Checkpoint: screenshots of both versions + all wording for approval.

**Phase 2 — Kerala design and motifs**
Kasavu borders, nilavilakku, jasmine strings, banana leaf/lotus corners, tharavadu
doors, Ganapathi line-art, venue vignettes, typography and spacing polish, the opening
animation, sticky mini-nav.
✅ Checkpoint: screenshots + short screen recording or step-by-step description of the
opening animation.

**Phase 3 — Couple illustrations**
Draw the three generic couple illustrations (hero, namaste, back) and wire them through
the `images` block so they can be swapped later by changing one path.
✅ Checkpoint: the three illustrations shown on their own and in place on the page.

**Phase 4 — Interactions**
Calendar buttons, RSVP form UI (with WhatsApp fallback while the API is empty), music
toggle, gallery UI (behind the setting), upload page UI.
✅ Checkpoint: demo each on localhost.

**Phase 5 — Google backend**
Write `apps-script/Code.gs` and its README. Walk Saurav through deploying it. Put the
URL in `config.js`. Test: config loads, RSVP rows appear, Summary counts are right,
an upload lands in Pending, approval moves it, gallery shows it.
✅ Checkpoint: Saurav confirms rows and files in his Sheet and Drive.

**Phase 6 — Assets and deploy**
QR codes, OG images, PDFs. Then, with Saurav's go-ahead: create the GitHub repo
`anusha-saurav` under `footballest` (public), push, enable Pages (main, root), verify
both live URLs, check WhatsApp previews.
✅ Checkpoint: both live links work on Saurav's phone.

**Phase 7 — After the wedding (later)**
Turn on `gallery_enabled`, share the upload link + passcode with friends, approve
photos, optionally add a thank-you message to both versions.

---

## 13. Working style

- Small commits with clear messages, one feature per commit.
- When something needs Saurav to click in Google, GitHub or his phone, give numbered
  steps and wait.
- If a requirement here conflicts with what you see working better, explain the
  trade-off and ask before changing direction.
- Keep this file updated: if a decision changes (wording, colours, a new section), edit
  CLAUDE.md in the same commit.
