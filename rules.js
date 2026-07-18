// HeaderForge — pure rule-compilation logic.
//
// This file has NO dependency on the chrome.* APIs so it can be unit-tested in
// Node. It loads three ways:
//   • service worker  — `importScripts("rules.js")` attaches the API to `self`
//   • popup page      — `<script src="rules.js">` attaches the API to `window`
//   • Node tests      — `require("./rules.js")` returns the API via module.exports
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    Object.assign(root, api);
  }
})(typeof self !== "undefined" ? self : globalThis, function () {
  /**
   * declarativeNetRequest resource types the rules apply to (all of them, so
   * header changes cover main documents, sub-resources, XHR/fetch, etc.).
   * @type {string[]}
   */
  const RESOURCE_TYPES = [
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other",
  ];

  /**
   * Normalize a profile's filters to a `urlFilters` array, migrating the legacy
   * single-string `urlFilter` field in place.
   * @param {{ urlFilters?: string[], urlFilter?: string }} profile
   * @returns {void}
   */
  function normalizeProfileFilters(profile) {
    if (!Array.isArray(profile.urlFilters)) {
      const legacy = (profile.urlFilter || "").trim();
      profile.urlFilters = legacy ? [legacy] : [];
    }
    delete profile.urlFilter;
  }

  /**
   * Compile one profile into modifyHeaders rules — one rule per URL filter (so a
   * profile can target multiple sites), or a single site-wide rule if it has no
   * filters.
   * @param {object} profile
   * @param {number} startId First unused dynamic-rule id.
   * @returns {object[]} Zero or more rules. Empty if the profile is disabled or
   *   has no active headers.
   */
  function buildRules(profile, startId) {
    if (!profile || !profile.enabled) return [];

    const active = (profile.headers || []).filter(
      (h) => h.enabled && h.name && h.name.trim() !== ""
    );
    if (active.length === 0) return [];

    const requestHeaders = [];
    const responseHeaders = [];

    for (const h of active) {
      const directive = {
        header: h.name.trim(),
        operation: h.op === "remove" ? "remove" : "set",
      };
      if (directive.operation === "set") directive.value = h.value ?? "";
      (h.type === "response" ? responseHeaders : requestHeaders).push(directive);
    }

    const action = { type: "modifyHeaders" };
    if (requestHeaders.length) action.requestHeaders = requestHeaders;
    if (responseHeaders.length) action.responseHeaders = responseHeaders;

    const filters = (profile.urlFilters || [])
      .map((f) => (f || "").trim())
      .filter(Boolean);

    const conditions =
      filters.length === 0
        ? [{ resourceTypes: RESOURCE_TYPES }]
        : filters.map((urlFilter) => ({
            resourceTypes: RESOURCE_TYPES,
            urlFilter,
          }));

    return conditions.map((condition, i) => ({
      id: startId + i,
      priority: 1,
      action,
      condition,
    }));
  }

  /**
   * Compile the full dynamic rule set from persisted state.
   * @param {{ enabled?: boolean, profiles?: object[] }} state
   * @returns {{ rules: object[], activeProfileCount: number }}
   */
  function compileRules(state) {
    const rules = [];
    let activeProfileCount = 0;

    if (state && state.enabled) {
      let ruleId = 1;
      for (const profile of state.profiles || []) {
        const profileRules = buildRules(profile, ruleId);
        if (profileRules.length) activeProfileCount += 1;
        for (const r of profileRules) rules.push(r);
        ruleId += profileRules.length;
      }
    }

    return { rules, activeProfileCount };
  }

  return { RESOURCE_TYPES, normalizeProfileFilters, buildRules, compileRules };
});
