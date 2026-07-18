// HeaderForge — service worker
// Reads state from chrome.storage.local and translates each enabled profile
// into its own dynamic declarativeNetRequest rule. Profiles are scoped by
// their own URL filter, so different sites can get different headers.

/**
 * A single header modification within a profile.
 * @typedef {Object} Header
 * @property {string} id       Stable unique id.
 * @property {boolean} enabled Whether this header is applied.
 * @property {"request"|"response"} type Direction the header applies to.
 * @property {"set"|"remove"} op Operation to perform.
 * @property {string} name     Header name (e.g. "Authorization").
 * @property {string} value    Header value; ignored when `op` is "remove".
 */

/**
 * A named, independently-scoped set of headers.
 * @typedef {Object} Profile
 * @property {string} id        Stable unique id.
 * @property {string} name      Display name shown in the tab bar.
 * @property {boolean} enabled  Whether this profile contributes a rule.
 * @property {string} urlFilter declarativeNetRequest urlFilter; blank = all URLs.
 * @property {Header[]} headers Headers belonging to this profile.
 */

/**
 * Persisted extension state (the value under {@link STORAGE_KEY}).
 * @typedef {Object} State
 * @property {boolean} enabled          Master switch for all profiles.
 * @property {string|null} activeProfileId Id of the profile shown in the editor.
 * @property {Profile[]} profiles       All configured profiles.
 */

const STORAGE_KEY = "headerforge:state";

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

/** @type {State} */
const DEFAULT_STATE = {
  enabled: true,
  activeProfileId: null,
  profiles: [],
};

/**
 * Read and normalize the persisted state.
 * @returns {Promise<State>}
 */
async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(stored[STORAGE_KEY] || {}) };
}

/**
 * Compile one profile into a single modifyHeaders rule.
 * @param {Profile} profile
 * @param {number} ruleId Unique dynamic-rule id to assign.
 * @returns {chrome.declarativeNetRequest.Rule|null} The rule, or null if the
 *   profile is disabled or has no active headers to contribute.
 */
function buildRule(profile, ruleId) {
  if (!profile.enabled) return null;

  const active = (profile.headers || []).filter(
    (h) => h.enabled && h.name && h.name.trim() !== ""
  );
  if (active.length === 0) return null;

  /** @type {chrome.declarativeNetRequest.ModifyHeaderInfo[]} */
  const requestHeaders = [];
  /** @type {chrome.declarativeNetRequest.ModifyHeaderInfo[]} */
  const responseHeaders = [];

  for (const h of active) {
    /** @type {chrome.declarativeNetRequest.ModifyHeaderInfo} */
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

  const condition = { resourceTypes: RESOURCE_TYPES };
  const filter = (profile.urlFilter || "").trim();
  if (filter) condition.urlFilter = filter;

  return { id: ruleId, priority: 1, action, condition };
}

/**
 * Rebuild the full dynamic rule set from the current state and install it,
 * replacing whatever is currently active.
 * @returns {Promise<void>}
 */
async function syncRules() {
  const state = await getState();

  const rules = [];
  if (state.enabled) {
    let ruleId = 1;
    for (const profile of state.profiles || []) {
      const rule = buildRule(profile, ruleId);
      if (rule) {
        rules.push(rule);
        ruleId += 1;
      }
    }
  }

  // Clear whatever is currently installed, then add the fresh set.
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
    await updateBadge(state, rules.length);
  } catch (err) {
    console.error("[HeaderForge] Failed to update rules:", err);
  }
}

/**
 * Reflect the current status on the toolbar badge.
 * @param {State} state
 * @param {number} activeProfileCount Number of profiles contributing a rule.
 * @returns {Promise<void>}
 */
async function updateBadge(state, activeProfileCount) {
  if (!state.enabled) {
    await chrome.action.setBadgeText({ text: "off" });
    await chrome.action.setBadgeBackgroundColor({ color: "#a1a1aa" });
    return;
  }
  if (activeProfileCount > 0) {
    await chrome.action.setBadgeText({ text: String(activeProfileCount) });
    await chrome.action.setBadgeBackgroundColor({ color: "#18181b" });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) syncRules();
});

syncRules();
