// Unit tests for the pure rule-compilation logic in rules.js.
// Run with: node --test   (no dependencies required)

import test from "node:test";
import { deepEqual, ok, equal } from "node:assert/strict";
import { RESOURCE_TYPES, normalizeProfileFilters, buildRules, compileRules } from "../rules.js";

/* ---------------- helpers ---------------- */

function header(overrides = {}) {
  return {
    id: "h",
    enabled: true,
    type: "request",
    op: "set",
    name: "X-Test",
    value: "1",
    ...overrides,
  };
}

function profile(overrides = {}) {
  return {
    id: "p",
    name: "P",
    enabled: true,
    urlFilters: [],
    headers: [header()],
    ...overrides,
  };
}

/* ---------------- normalizeProfileFilters ---------------- */

test("normalize: legacy urlFilter string becomes a one-element array", () => {
  const p = { urlFilter: "example.com" };
  normalizeProfileFilters(p);
  deepEqual(p.urlFilters, ["example.com"]);
  ok(!("urlFilter" in p), "legacy field is removed");
});

test("normalize: blank legacy urlFilter becomes an empty array", () => {
  const p = { urlFilter: "   " };
  normalizeProfileFilters(p);
  deepEqual(p.urlFilters, []);
});

test("normalize: missing filters becomes an empty array", () => {
  const p = {};
  normalizeProfileFilters(p);
  deepEqual(p.urlFilters, []);
});

test("normalize: existing urlFilters array is left untouched", () => {
  const p = { urlFilters: ["a.com", "b.com"] };
  normalizeProfileFilters(p);
  deepEqual(p.urlFilters, ["a.com", "b.com"]);
});

/* ---------------- buildRules ---------------- */

test("buildRules: disabled profile yields no rules", () => {
  deepEqual(buildRules(profile({ enabled: false }), 1), []);
});

test("buildRules: profile with no active headers yields no rules", () => {
  const p = profile({
    headers: [header({ enabled: false }), header({ name: " " })],
  });
  deepEqual(buildRules(p, 1), []);
});

test("buildRules: no filters produces one all-sites rule", () => {
  const rules = buildRules(profile(), 5);
  equal(rules.length, 1);
  equal(rules[0].id, 5);
  equal(rules[0].priority, 1);
  equal(rules[0].condition.urlFilter, undefined);
  deepEqual(rules[0].condition.resourceTypes, RESOURCE_TYPES);
});

test("buildRules: one rule per filter with incrementing ids", () => {
  const rules = buildRules(
    profile({ urlFilters: ["a.com", "b.com", "c.com"] }),
    10,
  );
  deepEqual(
    rules.map((r) => r.id),
    [10, 11, 12],
  );
  deepEqual(
    rules.map((r) => r.condition.urlFilter),
    ["a.com", "b.com", "c.com"],
  );
});

test("buildRules: blank/whitespace filters are trimmed and dropped", () => {
  const rules = buildRules(
    profile({ urlFilters: ["  a.com  ", "", "   "] }),
    1,
  );
  equal(rules.length, 1);
  equal(rules[0].condition.urlFilter, "a.com");
});

test("buildRules: request vs response headers are split into the right arrays", () => {
  const p = profile({
    headers: [
      header({ name: "Authorization", type: "request", value: "Bearer x" }),
      header({ name: "X-Frame-Options", type: "response", op: "remove" }),
    ],
  });
  const [rule] = buildRules(p, 1);
  deepEqual(rule.action.requestHeaders, [
    { header: "Authorization", operation: "set", value: "Bearer x" },
  ]);
  deepEqual(rule.action.responseHeaders, [
    { header: "X-Frame-Options", operation: "remove" },
  ]);
});

test("buildRules: 'remove' op omits the value; 'set' keeps it", () => {
  const p = profile({
    headers: [
      header({ name: "A", op: "set", value: "v" }),
      header({ name: "B", op: "remove", value: "ignored" }),
    ],
  });
  const [rule] = buildRules(p, 1);
  deepEqual(rule.action.requestHeaders, [
    { header: "A", operation: "set", value: "v" },
    { header: "B", operation: "remove" },
  ]);
});

test("buildRules: header name is trimmed", () => {
  const p = profile({ headers: [header({ name: "  X-Trim  " })] });
  const [rule] = buildRules(p, 1);
  equal(rule.action.requestHeaders[0].header, "X-Trim");
});

/* ---------------- compileRules ---------------- */

test("compileRules: master switch off yields nothing", () => {
  const state = { enabled: false, profiles: [profile()] };
  deepEqual(compileRules(state), { rules: [], activeProfileCount: 0 });
});

test("compileRules: allocates unique ids across profiles and counts active ones", () => {
  const state = {
    enabled: true,
    profiles: [
      profile({ id: "p1", urlFilters: ["a.com", "b.com"] }), // 2 rules
      profile({ id: "p2", enabled: false }), // 0 rules (disabled)
      profile({ id: "p3", urlFilters: [] }), // 1 rule
    ],
  };
  const { rules, activeProfileCount } = compileRules(state);
  deepEqual(
    rules.map((r) => r.id),
    [1, 2, 3],
  );
  equal(activeProfileCount, 2);
});

test("compileRules: tolerates empty/undefined state", () => {
  deepEqual(compileRules(undefined), {
    rules: [],
    activeProfileCount: 0,
  });
  deepEqual(compileRules({ enabled: true }), {
    rules: [],
    activeProfileCount: 0,
  });
});
