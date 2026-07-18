// HeaderForge — service worker
// Reads state from chrome.storage.local and translates each enabled profile
// into its own dynamic declarativeNetRequest rule. Profiles are scoped by
// their own URL filter, so different sites can get different headers.

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

const DEFAULT_STATE = {
  enabled: true,
  activeProfileId: null,
  profiles: [],
};

async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(stored[STORAGE_KEY] || {}) };
}

// Compile one profile into a single modifyHeaders rule, or null if it has
// nothing active to contribute.
function buildRule(profile, ruleId) {
  if (!profile.enabled) return null;

  const active = (profile.headers || []).filter(
    (h) => h.enabled && h.name && h.name.trim() !== ""
  );
  if (active.length === 0) return null;

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

  const condition = { resourceTypes: RESOURCE_TYPES };
  const filter = (profile.urlFilter || "").trim();
  if (filter) condition.urlFilter = filter;

  return { id: ruleId, priority: 1, action, condition };
}

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
