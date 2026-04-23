# Testing

## Manual acceptance checklist for Phase 1

Run this checklist before each commit that touches interception or decision code.

**Setup:** Load unpacked extension in Chrome (chrome://extensions, Developer mode, Load unpacked → dist/).

| Criterion | Pass? | Notes |
|-----------|-------|-------|
| Navigating to `youtube.com` redirects to block page | ☐ | Home page should be blocked |
| Navigating to `/results?search_query=test` redirects to block page | ☐ | Search results should be blocked |
| Navigating to `/shorts/xyz` redirects to block page | ☐ | Shorts should be blocked |
| Navigating to a whitelisted video ID loads normally | ☐ | Add a video to whitelist first; player should load |
| Navigating to a non-whitelisted video ID redirects to block page | ☐ | Block page should show |
| Whitelist survives browser restart | ☐ | Add video to whitelist, restart Chrome, check whitelist is still there |
| In-page SPA navigation is intercepted | ☐ | On a playlist page, click a video; if not whitelisted, should redirect |
| Block page shows "add to whitelist" link for videos/playlists | ☐ | Block page should extract ID and offer link |
| Block page shows back button | ☐ | Can navigate back to previous page |
| Popup displays current whitelist | ☐ | Open extension popup, should show whitelisted IDs |
| Popup allows adding video by ID | ☐ | Paste video ID in popup, click add, should appear in whitelist |
| Popup allows removing video from whitelist | ☐ | Click remove button on a whitelisted video, should disappear |
| Popup allows adding video by pasting full URL | ☐ | Paste full URL (e.g., youtube.com/watch?v=xyz), should extract ID |

## Manual acceptance checklist for Phase 2

(Defer until Phase 1 passes all criteria above.)

| Criterion | Pass? | Notes |
|-----------|-------|-------|
| On a whitelisted video, related videos panel is gone | ☐ | |
| Comments are gone | ☐ | |
| End-screen suggestion cards are gone | ☐ | |
| Autoplay is off | ☐ | |
| Theater mode / fullscreen still work | ☐ | |
| If YouTube changes a selector, page still loads (degraded) | ☐ | Check console for warnings |

## Manual acceptance checklist for Phase 3

(Defer until Phase 2 passes.)

| Criterion | Pass? | Notes |
|-----------|-------|-------|
| Password is never in storage as plaintext | ☐ | chrome.storage.local dump should show only hash + salt |
| Wrong password 5× locks unlock UI for 5 minutes | ☐ | Try wrong password 5 times; UI should disable |
| Override expires exactly when timer says it does | ☐ | Set 10 min override, check expiry time |
| README documents the limitation | ☐ | User can disable extension from chrome://extensions |

## Unit tests

Run with:

```bash
npm test
```

- Decision engine: whitelist rule, override rule, fail-closed logic
- Storage: schema initialization, round-trip for whitelist/settings
- URL classifier: extract video ID, playlist ID, classify route type
- (Phase 4) Keyword scorer: empty query, allow-only, block-only, mixed, case insensitivity
- (Phase 5) Embedding provider interface (null provider throws)

Add tests as you implement each module. Aim for >80% coverage of decision/storage/classifier logic.
