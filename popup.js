// HeaderForge: popup controller
// Multi-profile UI. State is persisted to chrome.storage.local; the service
// worker watches that key and rebuilds the declarativeNetRequest rules.

import { normalizeProfileFilters } from "./rules.js";

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
 * @property {string[]} urlFilters URL filters; the profile applies to any URL
 *   matching ANY of these. Empty = all sites.
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

/**
 * Create a fresh profile with a generated id.
 * @param {string} [name] Optional display name.
 * @returns {Profile}
 */
function makeProfile(name) {
  return {
    id: uid(),
    name: name || "New profile",
    enabled: true,
    urlFilters: [],
    headers: [],
  };
}

/**
 * Build the initial state containing one empty "Default" profile.
 * @returns {State}
 */
function defaultState() {
  const p = makeProfile("Default");
  return { enabled: true, activeProfileId: p.id, profiles: [p] };
}

/** @type {State} */
let state = defaultState();

const el = {
  master: document.getElementById("master-toggle"),
  tabs: document.getElementById("tabs"),
  profileEnabled: document.getElementById("profile-enabled"),
  profileName: document.getElementById("profile-name"),
  deleteProfile: document.getElementById("delete-profile"),
  filters: document.getElementById("filters"),
  addFilter: document.getElementById("add-filter"),
  list: document.getElementById("header-list"),
  empty: document.getElementById("empty-state"),
  addBtn: document.getElementById("add-header"),
  clearBtn: document.getElementById("clear-all"),
  rowTemplate: document.getElementById("row-template"),
  filterTemplate: document.getElementById("filter-template"),
  tabTemplate: document.getElementById("tab-template"),
};

/**
 * @returns {string} A RFC-4122 v4 uuid (secure context in extension popups).
 */
function uid() {
  return crypto.randomUUID();
}

/**
 * The profile currently shown in the editor, falling back to the first one.
 * @returns {Profile}
 */
function activeProfile() {
  return (
    state.profiles.find((p) => p.id === state.activeProfileId) ||
    state.profiles[0]
  );
}

/**
 * Load persisted state (or seed a default) and render.
 * @returns {Promise<void>}
 */
async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const loaded = stored[STORAGE_KEY];
  if (loaded && Array.isArray(loaded.profiles) && loaded.profiles.length) {
    state = loaded;
    state.profiles.forEach(normalizeProfileFilters);
    if (!state.profiles.some((p) => p.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles[0].id;
    }
  } else {
    state = defaultState();
  }
  render();
}

/**
 * Persist the current state; the service worker re-syncs rules on change.
 * @returns {Promise<void>}
 */
async function persist() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

/* ---------- Render ---------- */

/** Re-render the whole popup from `state`. @returns {void} */
function render() {
  el.master.checked = !!state.enabled;
  renderTabs();
  renderEditor();
}

/** Render the profile tab bar and the trailing "add profile" button. @returns {void} */
function renderTabs() {
  el.tabs.textContent = "";

  for (const profile of state.profiles) {
    const frag = el.tabTemplate.content.cloneNode(true);
    const tab = frag.querySelector(".tab");
    tab.querySelector(".tab-name").textContent = profile.name || "Untitled";
    tab.classList.toggle("active", profile.id === state.activeProfileId);
    tab.classList.toggle("paused", !profile.enabled);
    tab.addEventListener("click", () => {
      state.activeProfileId = profile.id;
      render();
      persist();
    });
    el.tabs.appendChild(frag);
  }

  // "+" add-profile button
  const add = document.createElement("button");
  add.className = "tab-add";
  add.title = "New profile";
  add.setAttribute("aria-label", "New profile");
  add.innerHTML =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
  add.addEventListener("click", () => {
    const p = makeProfile(`Profile ${state.profiles.length + 1}`);
    state.profiles.push(p);
    state.activeProfileId = p.id;
    render();
    el.profileName.select();
    persist();
  });
  el.tabs.appendChild(add);
}

/** Render the active profile's controls and header rows. @returns {void} */
function renderEditor() {
  const profile = activeProfile();

  el.profileEnabled.checked = profile.enabled;
  el.profileName.value = profile.name;
  el.deleteProfile.disabled = state.profiles.length <= 1;

  renderFilters(profile);

  el.list.textContent = "";
  const hasHeaders = profile.headers.length > 0;
  el.empty.hidden = hasHeaders;
  el.list.hidden = !hasHeaders;

  for (const header of profile.headers) {
    el.list.appendChild(renderRow(profile, header));
  }
}

/**
 * Render the active profile's URL-filter inputs (one per entry).
 * @param {Profile} profile
 * @returns {void}
 */
function renderFilters(profile) {
  el.filters.textContent = "";
  profile.urlFilters.forEach((_, index) => {
    el.filters.appendChild(renderFilter(profile, index));
  });
}

/**
 * Build one filter input row bound to `profile.urlFilters[index]`.
 * @param {Profile} profile
 * @param {number} index
 * @returns {HTMLElement}
 */
function renderFilter(profile, index) {
  const frag = el.filterTemplate.content.cloneNode(true);
  const item = frag.querySelector(".filter-item");
  const input = frag.querySelector(".filter-input");
  const remove = frag.querySelector(".filter-remove");

  input.value = profile.urlFilters[index];
  input.addEventListener("input", () => {
    profile.urlFilters[index] = input.value;
    persist();
  });
  remove.addEventListener("click", () => {
    profile.urlFilters.splice(index, 1);
    renderFilters(profile);
    persist();
  });

  return item;
}

/**
 * Build one interactive header row bound to `header` within `profile`.
 * @param {Profile} profile Owning profile (edited in place on interaction).
 * @param {Header} header   The header this row represents.
 * @returns {HTMLElement} The populated `.row` element.
 */
function renderRow(profile, header) {
  const frag = el.rowTemplate.content.cloneNode(true);
  const row = frag.querySelector(".row");

  const enabled = row.querySelector(".row-enabled");
  const type = row.querySelector(".row-type");
  const op = row.querySelector(".row-op");
  const name = row.querySelector(".row-name");
  const value = row.querySelector(".row-value");
  const remove = row.querySelector(".row-remove");

  enabled.checked = header.enabled;
  type.value = header.type;
  op.value = header.op;
  name.value = header.name;
  value.value = header.value;

  const applyOpState = () => {
    const isRemove = op.value === "remove";
    value.disabled = isRemove;
    value.style.visibility = isRemove ? "hidden" : "visible";
  };
  applyOpState();
  row.classList.toggle("disabled", !enabled.checked);

  enabled.addEventListener("change", () => {
    header.enabled = enabled.checked;
    row.classList.toggle("disabled", !enabled.checked);
    persist();
  });
  type.addEventListener("change", () => {
    header.type = type.value;
    persist();
  });
  op.addEventListener("change", () => {
    header.op = op.value;
    applyOpState();
    persist();
  });
  name.addEventListener("input", () => {
    header.name = name.value;
    persist();
  });
  value.addEventListener("input", () => {
    header.value = value.value;
    persist();
  });
  remove.addEventListener("click", () => {
    profile.headers = profile.headers.filter((h) => h.id !== header.id);
    renderEditor();
    persist();
  });

  return row;
}

/* ---------- Global controls ---------- */

el.master.addEventListener("change", () => {
  state.enabled = el.master.checked;
  persist();
});

el.profileEnabled.addEventListener("change", () => {
  activeProfile().enabled = el.profileEnabled.checked;
  renderTabs();
  persist();
});

el.profileName.addEventListener("input", () => {
  activeProfile().name = el.profileName.value;
  renderTabs();
  persist();
});

el.deleteProfile.addEventListener("click", () => {
  if (state.profiles.length <= 1) return;
  const id = state.activeProfileId;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  state.activeProfileId = state.profiles[0].id;
  render();
  persist();
});

el.addFilter.addEventListener("click", () => {
  const profile = activeProfile();
  profile.urlFilters.push("");
  renderFilters(profile);
  const inputs = el.filters.querySelectorAll(".filter-input");
  const last = inputs[inputs.length - 1];
  if (last) last.focus();
  persist();
});

el.addBtn.addEventListener("click", () => {
  const profile = activeProfile();
  profile.headers.push({
    id: uid(),
    enabled: true,
    type: "request",
    op: "set",
    name: "",
    value: "",
  });
  renderEditor();
  const rows = el.list.querySelectorAll(".row");
  const last = rows[rows.length - 1];
  if (last) last.querySelector(".row-name").focus();
  persist();
});

el.clearBtn.addEventListener("click", () => {
  const profile = activeProfile();
  if (profile.headers.length === 0) return;
  profile.headers = [];
  renderEditor();
  persist();
});

load();
