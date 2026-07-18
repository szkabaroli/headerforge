# HeaderForge

A small, **open-source** Chrome extension for injecting and modifying HTTP request/response
headers on any site — a clean alternative to ModHeader, with a shadcn/ui-inspired interface.

Unlike some popular header tools, HeaderForge is intentionally minimal and auditable:
- No accounts, no telemetry, no remote code, no analytics.
- Every file in this repo is plain, readable JS/CSS/HTML — read it before you install it.
- Uses the modern `declarativeNetRequest` API, so header rewriting happens inside Chrome's
  network stack — the extension never reads your request bodies or page contents.

## Features

- Set or remove **request** and **response** headers.
- Per-header enable/disable checkbox.
- Global master toggle to pause all rules instantly.
- Optional URL filter to scope rules to specific hosts/paths.
- Badge shows how many headers are active.
- Automatic light/dark theme.

## Install (developer / unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and click the toolbar icon to open the popup.

## Usage

1. Click **Add header**.
2. Choose direction (**Req**/**Res**) and operation (**Set**/**Remove**).
3. Type a header name and value (value is hidden for *Remove*).
4. (Optional) Enter a **URL filter**, e.g. `https://api.example.com` — leave blank to
   apply to every site. The filter uses `declarativeNetRequest` `urlFilter` matching.
5. Toggle individual headers or the master switch as needed. Changes apply immediately.

## How it works

- `popup.js` owns the UI and persists state to `chrome.storage.local`.
- `background.js` (service worker) watches storage and compiles the active headers into a
  single dynamic `declarativeNetRequest` rule. Disabled headers and the master-off state
  produce no rule at all.

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Rewrite headers via Chrome's network rules |
| `storage` | Persist your header list locally |
| `host_permissions: <all_urls>` | Allow header rules to apply to any site you visit |

## Limitations

- `declarativeNetRequest` cannot modify a handful of protected headers in some Chrome
  versions; check `chrome://extensions` error logs if a header doesn't apply.
- Response-header modification and some resource types depend on your Chrome version.

## Testing

The rule-compilation logic (state → declarativeNetRequest rules, filter
migration, multi-site expansion) lives in `rules.js`, which is dependency-free
and shared by the service worker, the popup, and the tests. Run the suite with
Node's built-in test runner (no `npm install` needed):

```bash
npm test          # or: node --test
```

`rules.js` loads three ways from one file: `importScripts` in the service
worker, `<script>` in the popup, and `require` in the tests — so the exact code
that ships is the code under test.

## Privacy

HeaderForge has no servers, sends no data, and includes no analytics — all
configuration stays in your browser's local storage. See [PRIVACY.md](PRIVACY.md).

## Publishing

To package and publish to the Chrome Web Store, run `./build-zip.sh` and follow
[PUBLISHING.md](PUBLISHING.md).

## License

MIT
