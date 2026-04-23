# Roadmap

## Phase 1 — Strict whitelist (MVP)

**Status:** In progress

**Build:**
- [ ] `chrome.webNavigation.onBeforeNavigate` listener
- [ ] URL classifier (extract video/playlist IDs, classify route type)
- [ ] Decision engine with whitelist rule
- [ ] Redirect non-whitelisted navigations to block page
- [ ] Popup UI (whitelist management, paste-URL-to-extract helper)
- [ ] Block page (reason display, "add to whitelist" link, back button)
- [ ] Storage module with schema v1
- [ ] Service worker background listener
- [ ] Content script for History API fallback
- [ ] Unit tests for decision engine

**Acceptance Criteria:**
- [ ] Navigating to `youtube.com` redirects to block page
- [ ] Navigating to `/results?search_query=…` redirects to block page
- [ ] Navigating to `/shorts/…` redirects to block page
- [ ] Navigating to a whitelisted video ID loads normally
- [ ] Navigating to a non-whitelisted video ID redirects to block page
- [ ] Whitelist survives browser restart
- [ ] In-page SPA navigation (clicking a video from a playlist) is intercepted

**How to verify:** Manual testing in Chrome (see TESTING.md for checklist).

---

## Phase 2 — DOM cleanup on allowed pages

**Status:** Not started

**Build:**
- Content script with MutationObserver
- Hide: `#related`, `#comments`, `ytd-mini-guide-renderer`, `ytd-guide-renderer`, end-screen suggestions, autoplay toggle
- Disable autoplay via player API or click

**Acceptance Criteria:**
- [ ] Related videos panel is hidden
- [ ] Comments are hidden
- [ ] End-screen suggestions are hidden
- [ ] Autoplay is off
- [ ] Theater mode / fullscreen still work
- [ ] If YouTube changes an ID, the page still loads (degraded, not broken)

**How to verify:** Manual testing in Chrome.

---

## Phase 3 — Password + override

**Status:** Not started

**Build:**
- First-run flow: set password (min 8 chars, confirm twice)
- PBKDF2 hashing (100k iterations, 16-byte salt) via SubtleCrypto
- "Unlock for N minutes" button (10 / 20 / 30 presets)
- Override timer in popup
- Rate limit: 5 failed attempts → 5 min UI lockout

**Acceptance Criteria:**
- [ ] Password is never in storage as plaintext
- [ ] Wrong password 5× locks unlock UI for 5 minutes
- [ ] Override expires exactly when timer says it does
- [ ] README documents the limitation (user can still disable extension)

**How to verify:** Storage inspection + manual testing in Chrome.

---

## Phase 4 — Rule-based filter

**Status:** Not started

**Build:**
- New decision rule for search URLs
- Allow keywords: tutorial, lecture, explained, course, problem solving, walkthrough (configurable)
- Block keywords: vlog, prank, reaction, meme, shorts, compilation (configurable)
- Scoring: +1 allow, -2 block; negative → block, positive → override required
- Popup UI for keyword list management
- Unit tests for scorer (Vitest)

**Acceptance Criteria:**
- [ ] Keyword lists round-trip through storage
- [ ] Editable in popup settings
- [ ] Unit tests pass: empty query, allow-only, block-only, mixed, case insensitivity

**How to verify:** Unit tests + manual testing in Chrome.

---

## Phase 5 — Local semantic filter (scaffolding)

**Status:** Not started

**Build:**
- Abstract `EmbeddingProvider` interface
- `NullEmbeddingProvider` (throws, proves plumbing)
- Decision rule combining embedding similarity + Phase 4 keyword score
- Toggle in settings to enable/disable (default off)
- Documentation for plugging in `@xenova/transformers`

**Acceptance Criteria:**
- [ ] With toggle off, behavior identical to Phase 4
- [ ] Interface is documented
- [ ] No network requests fire

**How to verify:** DevTools Network tab + feature toggle + manual testing.

---

## Phase 6 — Context mode

**Status:** Deferred

**Sketch:** Add session-based, time-boxed contexts (e.g., "math study session", 30 min, auto-unlock relevant topics). Not building unless Phases 1–5 are solid.

---

## Testing strategy

- **Vitest unit tests:** Decision engine, storage migrations, keyword scorer
- **Manual acceptance checklist:** One row per criterion above; re-run before each commit
- **No end-to-end Chrome tests** (setup cost not worth it at this stage)

See `TESTING.md` for the manual checklist.
