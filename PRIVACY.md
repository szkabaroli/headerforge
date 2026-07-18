# Privacy Policy — HeaderForge

_Last updated: 2026-07-18_

HeaderForge is a browser extension that modifies HTTP request and response
headers according to rules you configure. This policy explains exactly what the
extension does and does not do with data.

## The short version

**HeaderForge collects nothing, sends nothing, and has no servers.** Everything
you configure stays on your own computer.

## What data is stored

The only data HeaderForge stores is the header configuration you create in the
popup — your profiles, their names, URL filters, and the header names/values you
enter. This is saved locally using the browser's `chrome.storage.local` API on
your device.

## Where it goes

Nowhere. HeaderForge:

- has **no backend server** and makes **no network requests** of its own;
- contains **no analytics, tracking, telemetry, or advertising** code;
- loads **no remote code** — all logic ships inside the extension package;
- does **not** transmit, sell, or share your configuration or browsing data with
  anyone.

## Access to your browsing

To apply header rules, HeaderForge requests the `declarativeNetRequest` permission
and host access (`<all_urls>`). This lets the browser apply your header rules to
matching requests. Header rewriting is performed **by the browser itself** through
declarative rules — the extension **cannot read, log, or receive** the contents of
your requests, responses, cookies, or page data. It only tells the browser which
headers to set or remove.

## Your control

- Header configuration lives only in your browser's local storage.
- Removing a profile or clicking **Clear** deletes that data immediately.
- Uninstalling the extension removes all stored configuration.

## Permissions summary

| Permission              | Why it is needed                                        |
| ----------------------- | ------------------------------------------------------- |
| `declarativeNetRequest` | Apply header set/remove rules via the browser's engine  |
| `storage`               | Save your header configuration locally on your device   |
| host access (`<all_urls>`) | Allow your rules to apply to the sites you choose    |

## Changes

If this policy changes, the updated version will be published in the extension's
public repository at https://github.com/szkabaroli/headerforge.

## Contact

Questions? Open an issue at https://github.com/szkabaroli/headerforge/issues
or email szkabaroli@gmail.com.
