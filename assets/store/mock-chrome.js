// Minimal chrome.storage stub so the real popup.js renders with sample data
// outside the extension runtime (for store screenshots only).
const SEED = {
  "headerforge:state": {
    enabled: true,
    activeProfileId: "p1",
    profiles: [
      {
        id: "p1",
        name: "Staging API",
        enabled: true,
        urlFilters: ["https://api.staging.example.com", "staging.example.com"],
        headers: [
          {
            id: "h1",
            enabled: true,
            type: "request",
            op: "set",
            name: "Authorization",
            value: "Bearer eyJhbGciOiJ…",
          },
          {
            id: "h2",
            enabled: true,
            type: "request",
            op: "set",
            name: "X-Env",
            value: "staging",
          },
          {
            id: "h3",
            enabled: false,
            type: "response",
            op: "remove",
            name: "X-Frame-Options",
            value: "",
          },
        ],
      },
      {
        id: "p2",
        name: "Local debug",
        enabled: false,
        urlFilters: [],
        headers: [],
      },
    ],
  },
};

window.chrome = {
  storage: {
    local: {
      get: () => Promise.resolve(SEED),
      set: () => Promise.resolve(),
    },
    onChanged: { addListener() {} },
  },
};
