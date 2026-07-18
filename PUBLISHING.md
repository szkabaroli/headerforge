# Publishing HeaderForge to the Chrome Web Store

A step-by-step checklist. Everything up to the actual upload is scripted; the
upload itself must be done by you in the Developer Dashboard (Google requires a
signed-in developer account).

## 1. One-time setup

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in with the Google account you want to own the listing.
3. Pay the **one-time $5 USD** registration fee (required to publish any item).
4. Complete the account verification / publisher details Google asks for.

## 2. Build the upload package

From the repo root:

```bash
./build-zip.sh
```

This produces `dist/headerforge.zip` containing only the files the extension
ships (manifest, scripts, styles, popup, icons) — no README, git, or dev files.

## 3. Create the listing

In the dashboard, click **Add new item** and upload `dist/headerforge.zip`, then
fill in the **Store listing** tab:

- **Description** — reuse the top of `README.md`.
- **Category** — Developer Tools.
- **Language** — English.
- **Screenshots** — at least one 1280×800 (or 640×400) PNG of the popup. Take one
  with the extension loaded, or mock it up.
- **Small promo tile** — 440×280 PNG (optional but recommended).
- **Icon** — the store uses the 128×128 from the package automatically.

## 4. Privacy & permissions (this is where broad-permission extensions get stuck)

On the **Privacy practices** tab:

- **Single purpose** — e.g. "Modify HTTP request and response headers on sites the
  user chooses."
- **Permission justifications** — you must justify each one:
  - `declarativeNetRequest` — "Apply user-defined header set/remove rules via the
    browser's declarative networking engine."
  - `storage` — "Persist the user's header configuration locally."
  - Host permissions `<all_urls>` — "Header rules must be able to apply to whatever
    sites the user targets; the extension does not read request or page content."
- **Data usage** — declare that you do **not** collect or transfer any user data
  (all local). This matches `PRIVACY.md`.
- **Privacy policy URL** — required because of the broad host permission. Use the
  hosted `PRIVACY.md`, e.g.
  `https://github.com/szkabaroli/headerforge/blob/main/PRIVACY.md`.

## 5. Submit

Click **Submit for review**. Review typically takes anywhere from a few hours to a
few days. Extensions with `<all_urls>` + networking permissions get extra scrutiny,
so keep the justifications above accurate.

## Bumping a version

1. Increase `"version"` in `manifest.json` (e.g. `1.0.0` → `1.0.1`).
2. Re-run `./build-zip.sh`.
3. Upload the new zip to the existing item and submit for review.

## Optional: automate uploads later

Google offers the [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
for CI publishing (via a service account + refresh token). Worth setting up only
once you're releasing often; the manual dashboard flow above is fine to start.
