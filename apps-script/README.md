# Wedding site backend: Google Sheet + Apps Script

This connects the invitation site to a Google Sheet in **your** Google account. You'll
use the Sheet to:

- **edit the site's wording, events and contacts** without touching code
- **collect RSVPs**, with automatic totals in the Summary tab
- **receive photo uploads** from friends into Google Drive, then approve them for the gallery

Nothing here costs money. Everything stays in your Google account.

---

## Part A · Create the Sheet and add the script (about 10 minutes)

1. On a computer, open **https://sheets.google.com**, signed in as the Google account
   that should own the RSVPs.
2. Click **Blank spreadsheet** (the big **+**). Click **Untitled spreadsheet** at the
   top-left and name it **Anusha & Saurav · Wedding site**.
3. In the menu, click **Extensions → Apps Script**. A new tab opens with the script
   editor.
4. At the top-left, click **Untitled project** and rename it to **Wedding site**.
5. You'll see a file called **Code.gs** with a few lines in it. Click inside it, select
   everything (**Cmd+A** on a Mac) and delete it.
6. Open `apps-script/Code.gs` from this project, copy **all** of it, and paste it into
   the empty editor.
7. Press **Cmd+S** (or click the 💾 icon) to save.

## Part B · Run `setup` once

8. In the toolbar above the code, there's a drop-down that lists functions. Choose
   **setup**, then click **▶ Run**.
9. A box says **"Authorization required"**. Click **Review permissions** and pick your
   Google account.
10. You'll see **"Google hasn't verified this app"**. That's expected: you wrote it, and
    it only runs in your own account. Click **Advanced** (small link, bottom-left), then
    **Go to Wedding site (unsafe)**, then **Allow**.
    - It asks to see and edit your spreadsheets and Drive files (to write RSVPs and save
      photos) and to send email as you (for the RSVP notifications).
11. Wait until the log at the bottom says **Execution completed**. The last line before
    that starts with *Setup done.*
12. Go back to the Sheet tab and **reload the page**. You should now see:
    - tabs **Settings, Events, Contacts, Families, RSVP, Summary, Uploads**, already
      filled with the invitation content
    - a new menu **Wedding site** (to the right of Help)
    - in Google Drive, a folder **Anusha-Saurav Wedding**, containing *Pending uploads*
      and *Approved* (which holds *Save the Date*, *Wedding* and *Reception*)

## Part C · Publish it as a web app

13. In the script editor, click the blue **Deploy** button (top-right), then
    **New deployment**.
14. Next to **Select type**, click the **⚙ gear** and choose **Web app**.
15. Fill in:
    - **Description:** `v1`
    - **Execute as:** **Me** (your email)
    - **Who has access:** **Anyone**. Not "Anyone with Google account": guests won't be
      signed in.
16. Click **Deploy**. If it asks for authorization again, repeat step 10.
17. Copy the **Web app URL**. It looks like
    `https://script.google.com/macros/s/AKfycb…/exec`.
18. Put it in `assets/js/config.js`:
    ```js
    window.API_URL = "https://script.google.com/macros/s/AKfycb…/exec";
    ```
    Or send it to Claude to do. The URL isn't secret: it ends up in the public website
    code anyway.

**Quick check:** open the Web app URL with `?action=config` added at the end in a
browser. You should see text starting with `{"ok":true,"settings":{…`.

---

## After code changes: redeploy, keeping the same URL

If `Code.gs` changes later:

1. Paste the new code over the old one in the script editor and save.
2. Click **Deploy → Manage deployments**.
3. Select the existing deployment and click the **✏️ pencil (Edit)**.
4. Under **Version**, choose **New version**, then click **Deploy**.

The URL stays the same, so nothing on the website needs to change.
(**New deployment** would make a *new* URL; avoid that.)

---

## Day-to-day use

### Changing what the site says
- Edit the **Settings, Events, Contacts or Families** tabs. The site picks up changes
  within about 5 minutes. To push them at once, use **Wedding site → Refresh site cache**.
- Cells in those tabs are plain text on purpose (dates and `+91` numbers stay exactly as
  typed).
- Useful switches in **Settings** (type `TRUE` or `FALSE`):
  - `rsvp_open`: FALSE closes the RSVP form
  - `uploads_open`: FALSE pauses the photo upload page (if the row is missing, uploads are open)
  - `gallery_enabled`: TRUE shows the photo gallery (after the wedding)
  - `music_enabled`: FALSE hides the music button
  - `notify_email_on_rsvp`: FALSE stops the RSVP emails
- In `full_intro`, `**double stars**` make words bold.
- In `reception_greeting`, `{name}` becomes the name from the link (`…/reception/?to=Meera`).

### RSVPs
- Every response is a new row in **RSVP**. Leave this tab as it is; don't sort it.
- **Summary** is rebuilt automatically after every RSVP. It shows:
  - wedding and reception headcounts
  - reception food preferences (counted in guests)
  - declines, and a "latest answer per guest" list
- If someone uses **Change my response**, their new answer replaces the old one in the
  Summary. The RSVP tab still keeps both rows as history.
  - Because of this, two families answering from the *same* phone count as one. The
    second answer wins. Ask them to put everyone in one response with the guest count.
- To delete test rows: delete them in **RSVP**, then **Wedding site → Rebuild summary**.

### Photos from friends
1. Share the upload page link (`…/upload/`) with close friends. There is no passcode:
   anyone who has the link can send photos, so share it only where you'd be happy for it
   to be forwarded.
2. Their photos land in Drive → *Anusha-Saurav Wedding* → **Pending uploads**, and a row
   appears in the **Uploads** tab. Nothing is public yet: a photo reaches the gallery only
   after you approve it (next step).
3. To approve, open the **Uploads** tab and select the rows. Hold Cmd to pick several.
   Then choose **Wedding site → Approve selected uploads**, type **1** (Save the Date),
   **2** (Wedding) or **3** (Reception), and click OK. The photos move to that album
   and become viewable by link.
4. To leave a photo out, simply don't approve it. You can delete it from *Pending uploads*.
5. Your own photos (e.g. Save the Date): drag them straight into *Approved → Save the
   Date* in Drive, then run **Wedding site → Refresh site cache**. This also makes them
   viewable.
6. When you're ready, set `gallery_enabled` to `TRUE` in Settings.
7. To stop uploads (for example once you have enough photos, or if the link spreads too
   far), set `uploads_open` to `FALSE` in Settings. The upload page then shows a polite
   "paused" note.
8. As a safety net, the script accepts at most **2 GB of photos per day** from everyone
   together (about 1,500–2,000 phone photos). After that the page asks people to try
   again the next day. To change it, edit `DAILY_UPLOAD_MB` near the top of `Code.gs` and
   redeploy.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| The site shows "Online RSVP isn't available right now" | Check `config.js` has the URL. Open the URL + `?action=config` in a browser; if it asks you to sign in, the deployment's "Who has access" isn't **Anyone**. Redeploy with that fixed. |
| Upload page: "Photo uploads are paused" | `uploads_open` is FALSE in Settings. Set it to TRUE. |
| Upload page: "uploads are resting until tomorrow" | Today's 2 GB limit was reached. It resets at midnight (India time), or raise `DAILY_UPLOAD_MB` in `Code.gs` and redeploy. |
| The menu **Wedding site** is missing | Reload the Sheet. |
| A change to the code doesn't show up | Redeploy with **New version** (see above). |
| No RSVP emails | Check `notify_email_on_rsvp` is TRUE. Google allows about 100 emails a day on a free account. |
| Ran `setup` twice by mistake | That's fine: it never overwrites tabs that already have content and reuses the same folders. |
