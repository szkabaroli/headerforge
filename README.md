# HeaderForge

A Chrome extension for setting and removing HTTP request/response headers on the
sites you choose.

I started this after ModHeader (the popular header tool) shipped malware in an
update. I wanted something that did the same job but was small enough to read in
one sitting before trusting it. That's the whole pitch: it's a few hundred lines
of plain HTML/CSS/JS, no build step, no accounts, no network calls of its own.

## Features

- Set or remove request and response headers
- Group headers into profiles (e.g. one for staging, one for a local API)
- Scope each profile to one or more sites with URL filters, or leave it global
- Enable/disable individual headers, a whole profile, or everything at once
- Toolbar badge showing how many profiles are active
- Light/dark theme following the system

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on Developer mode (top-right)
3. Load unpacked, and pick this folder
4. Pin the icon and click it to open the popup

## Usage

Click **Add header**, pick the direction (Req/Res) and operation (Set/Remove),
and type a name and value. Under **Applies to**, add one or more URL filters to
limit a profile to certain sites; leave it empty to match everything. Changes
take effect immediately.

Filters use `declarativeNetRequest` matching: a plain string matches any URL
containing it (`example.com`), and `|` anchors the start/end
(`|https://api.example.com`).

## How it works

`popup.js` is the UI and saves state to `chrome.storage.local`. `background.js`
watches that storage and compiles it into dynamic `declarativeNetRequest`
rules, one per URL filter per profile. Because the browser applies those rules
itself, the extension never sees your request or page contents, which is also
why it only needs `declarativeNetRequest` + `storage` rather than `webRequest`.

The rule-building logic lives in `rules.js` on its own so it can be unit-tested.

## Permissions

| Permission               | Why                                           |
| ------------------------ | --------------------------------------------- |
| `declarativeNetRequest`  | Apply the header rules                        |
| `storage`                | Save your profiles locally                    |
| `<all_urls>` host access | Let rules apply to whichever sites you target |

## Testing

`rules.js` has no `chrome.*` dependencies and is loaded three ways from one
file: `importScripts` in the worker, `<script>` in the popup, and `require` in
the tests. So the tests exercise the exact code that ships. No dependencies:

```bash
npm test    # node --test
```

## Building

`npm run build` zips the runtime files into `dist/headerforge.zip` for the
Chrome Web Store. See [PUBLISHING.md](PUBLISHING.md) for the store steps, and
[PRIVACY.md](PRIVACY.md) for the privacy policy.

## Known limitations

- Chrome protects some headers (a few `Sec-*` and other forbidden ones) and
  won't let `declarativeNetRequest` change them.
- All filters in a profile share its headers; if you need different headers per
  site, make separate profiles.

## License

MIT
