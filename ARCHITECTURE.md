# Architecture

## Module overview

```
src/
  manifest.ts         — MV3 manifest definition
  background.ts       — service worker entry point
  
  interception/       — webNavigation listener, URL classification, redirect logic
    index.ts          — entry point, registers listeners
    classifier.ts     — extract video/playlist IDs, classify URL type
    router.ts         — decision engine integration, redirect to block page
  
  decision/           — pure functions: given URL + state, return Allow | Block | RequireOverride
    engine.ts         — rule registry and verdict logic
    rules/
      whitelist.ts    — Phase 1: strict ID-based whitelist rule
      keywords.ts     — Phase 4: keyword scoring rule
      semantic.ts     — Phase 5: embedding-based rule (scaffolding)
  
  ui/
    popup/
      index.html      — popup UI shell
      popup.ts        — UI logic, whitelist management, override trigger
      styles.css      — popup styling
    block/
      index.html      — redirect target page
      block.ts        — block page logic, "add to whitelist" link
      styles.css      — block page styling
    content/
      content.ts      — injected on allowed YouTube pages, DOM cleanup
  
  storage/            — typed wrapper over chrome.storage.local
    types.ts          — TypeScript interfaces (Settings, Storage)
    index.ts          — schema version, init, getters/setters
    migrations.ts     — schema upgrade logic
  
  security/           — password hashing, override session state
    password.ts       — PBKDF2 hashing with SubtleCrypto
    override.ts       — session timestamp + rate limiting for attempts
```

## Data flow

### 1. User navigates to YouTube URL

```
User click/address bar
    ↓
webNavigation.onBeforeNavigate listener
    ↓
URL classifier (extract IDs, classify type)
    ↓
Decision engine (run rules in priority order)
    ↓
Verdict: Allow | Block | RequireOverride
    ↓
If Allow: pass through
If Block/RequireOverride: redirect to chrome-extension://…/block.html?reason=…&from=…
```

### 2. SPA navigation (History API)

```
Content script detects History API change via popstate listener
    ↓
Post message to service worker with new URL
    ↓
Same decision engine as above
    ↓
Service worker broadcasts verdict back to content script
    ↓
Content script redirects page if needed
```

### 3. User interacts with popup

```
Popup opened
    ↓
Display current whitelist, settings
    ↓
User adds/removes IDs or clicks "Unlock for N minutes"
    ↓
Updates chrome.storage.local
    ↓
Service worker listeners react to storage changes (if needed)
```

## Storage schema (versioned)

```ts
{
  schemaVersion: 1,
  whitelist: {
    videos: string[],      // YouTube video IDs (e.g., ["dQw4w9WgXcQ"])
    playlists: string[]    // YouTube playlist IDs (e.g., ["PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"])
  },
  settings: {
    stripRelated: boolean,
    stripComments: boolean,
    stripShorts: boolean,
    allowKeywords: string[],
    blockKeywords: string[]
  },
  security: {
    passwordHash: string | null,  // PBKDF2(password, salt, 100k iterations)
    salt: string | null           // 16-byte random, base64 encoded
  },
  override: {
    activeUntil: number | null    // ms since epoch; null = not active
  },
  rateLimit: {
    attemptCount: number,
    lockedUntil: number | null
  }
}
```

All keys are optional at read time; default-initialized if missing.

## Decision engine contract

```ts
type Verdict = {
  action: 'allow' | 'block' | 'override_required';
  reason: string;
};

type Context = {
  url: URL;
  now: number;  // ms since epoch, for override expiry checks
  override: OverrideState;
  settings: Settings;
};

type Rule = (ctx: Context) => Verdict | null;
// null = no opinion, try next rule
// First non-null verdict wins
```

Rule registry (priority order):
1. Override rule — if `activeUntil > now`, return Allow for all URLs
2. Phase 1: Whitelist rule — check video/playlist ID against whitelist
3. Phase 4: Keyword rule — score based on allow/block keywords
4. Phase 5: Semantic rule — embedding similarity + Phase 4 score (scaffolding)
5. Default: Block (fail closed)

## Security notes

- **Password hashing:** PBKDF2 via SubtleCrypto, 100k iterations, 16-byte random salt. Never stored as plaintext.
- **Rate limiting:** 5 failed password attempts → 5 minute lockout on the UI (not enforced server-side; this is a UX feature, not a security boundary).
- **Override state:** Stored as `activeUntil` timestamp. Service worker checks `now > activeUntil` to determine if override is expired. On browser restart, service worker is killed but storage persists, so override state survives.
- **Fail closed:** If the decision engine errors, block the page (fail closed).

## Known limitations

- **Not a security boundary:** A determined user can disable the extension from `chrome://extensions` or edit storage directly. FocusedTube is a focus tool.
- **SPA navigation:** We rely on `onHistoryStateUpdated` + content script message fallback. If both fail, a user could navigate via JavaScript without triggering the decision engine. (Unlikely; `onHistoryStateUpdated` is reliable.)
- **YouTube selectors (Phase 2):** YouTube frequently changes DOM structure. We log warnings if selectors fail to match; the page still loads (degraded).

## Build & bundle size

- **Vite + CRXJS** handles code splitting and asset bundling.
- **Target:** <100KB gzipped for Phase 1–4 (service worker + popup + block page + content script combined).
- **No external CDNs or async imports** (all code bundled).
- Phase 5 embeddings (if included) may exceed this; we scaffold to make that swap-in-friendly.
