# Decisions

Running log of architectural and implementation choices.

## Phase 1

### Decision: Store video/playlist IDs, not full URLs

**Chosen:** Store IDs in whitelist (e.g., `"dQw4w9WgXcQ"`, not full URL).

**Reasoning:**
- YouTube URLs can be accessed via multiple formats: `/watch?v=…`, youtu.be shortlinks, playlist parameters in query strings, etc.
- Storing IDs is canonicalized and resilient to URL rewrites.
- Simpler to check on every navigation.

**Trade-off:** Requires parsing logic to extract IDs. Implemented in `interception/classifier.ts`.

---

### Decision: Fail closed on decision engine errors

**Chosen:** If the decision engine throws, block the page.

**Reasoning:**
- Security posture: assume deny.
- If our classification or rule logic breaks, better to be over-restrictive than leak an unvetted video.

**Implementation:** Service worker wraps decision logic in try/catch, defaults to verdict `{ action: 'block', reason: 'Internal error' }`.

---

### Decision: Use chrome.storage.local for override state (not memory)

**Chosen:** Store `override.activeUntil` (timestamp) in persistent storage.

**Reasoning:**
- Service workers can be killed by the browser. In-memory state would be lost.
- Persistent storage ensures override survives browser restart.
- Timestamp-based (not duration) so expiry works correctly even if service worker is terminated mid-override.

**Trade-off:** One extra storage read per navigation. Negligible (chrome.storage.local is fast).

---

### Decision: onHistoryStateUpdated + content script fallback for SPA

**Chosen:** Listen to `webNavigation.onHistoryStateUpdated` in service worker; content script also posts URL changes as a backup.

**Reasoning:**
- `onBeforeNavigate` only fires for hard navigations.
- YouTube uses History API for in-page transitions (clicking a video from a playlist).
- `onHistoryStateUpdated` is reliable and fires for History API calls.
- Content script fallback catches edge cases and provides a circuit-breaker pattern.

**Trade-off:** Slight duplication (two listeners for the same event), but robustness gain is worth it.

---

### Decision: Content script injected on /watch and /playlist only

**Chosen:** Match pattern `*://youtube.com/watch*` and `*://youtube.com/playlist*`.

**Reasoning:**
- Phase 2 (DOM cleanup) only applies to video and playlist pages.
- Avoid injecting on home, search, or recommendations pages (they're blocked anyway in Phase 1).
- Reduces extension overhead.

---

### Decision: MutationObserver for DOM changes, CSS visibility:hidden for hiding

**Chosen:** Phase 2 will use MutationObserver to reactively hide elements; use `visibility: hidden` (not `display: none`) to preserve layout.

**Reasoning:**
- YouTube's player is complex; removing DOM nodes can break playback.
- MutationObserver reacts to new DOM insertions (YouTube loads recommendations/comments dynamically).
- `visibility: hidden` hides the element without reflow.

**Trade-off:** Uses slightly more CPU (observer polling), but safer than DOM surgery.

---

## Phase 4 & 5

### Decision: Keyword score threshold (Phase 4)

**Chosen:** Net negative score (total -2 or lower) blocks; positive score requires override.

**Reasoning:**
- Conservative: each block keyword is worth -2, each allow keyword is worth +1.
- A single "prank" keyword blocks a URL (even if it has "tutorial" in the title).
- Keyword matching is a hint, not a trust. Requires human override to proceed.

---

### Decision: Embedding provider interface (Phase 5)

**Chosen:** Ship `NullEmbeddingProvider` that throws; document how to plug in `@xenova/transformers`.

**Reasoning:**
- Proves the plumbing without bundling a 20MB+ model in the extension.
- Allows future contributor to swap in a real model without touching decision logic.
- Keeps Phase 1–4 lean (<100KB gzipped).

---

## Open questions

None at this stage. Proceed with Phase 1 build.
