// HeaderForge: service worker
// Reads state from chrome.storage.local and compiles it into dynamic
// declarativeNetRequest rules (one per URL filter per profile), so different
// sites can get different headers.

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
 * @property {string[]} urlFilters declarativeNetRequest urlFilters; a profile
 *   applies to any URL matching ANY of these. Empty = all URLs.
 * @property {Header[]} headers Headers belonging to this profile.
 */

/**
 * Persisted extension state (the value under {@link STORAGE_KEY}).
 * @typedef {Object} State
 * @property {boolean} enabled          Master switch for all profiles.
 * @property {string|null} activeProfileId Id of the profile shown in the editor.
 * @property {Profile[]} profiles       All configured profiles.
 */

// Pure rule-compilation helpers, shared with the popup and the unit tests.
import { compileRules, normalizeProfileFilters } from "./rules.js";

const STORAGE_KEY = "headerforge:state";

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
  const state = { ...DEFAULT_STATE, ...(stored[STORAGE_KEY] || {}) };
  (state.profiles || []).forEach(normalizeProfileFilters);
  return state;
}

/**
 * Rebuild the full dynamic rule set from the current state and install it,
 * replacing whatever is currently active.
 * @returns {Promise<void>}
 */
async function syncRules() {
  const state = await getState();
  const { rules, activeProfileCount } = compileRules(state);

  // Clear whatever is currently installed, then add the fresh set.
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: rules,
    });
    await updateBadge(state, activeProfileCount);
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
