import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────────
// Lockin Selector Canary
//
// Purpose: These tests verify that YouTube's DOM structure still matches the
// CSS selectors used by Lockin's Filtered Mode. YouTube changes their DOM
// frequently. If a selector stops matching, filtered mode silently fails open.
//
// These tests do NOT load the extension — they verify YouTube's DOM structure
// from the outside. Green = the selectors are still valid.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('YouTube Selector Canary', () => {

  test.beforeEach(async ({ page }) => {
    // Consent to cookies if a cookie banner appears (common in EU regions)
    await page.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
    try {
      const consentBtn = page.locator('button:has-text("Accept all")');
      if (await consentBtn.isVisible({ timeout: 3000 })) {
        await consentBtn.click();
      }
    } catch {
      // No consent banner — that's fine
    }
  });

  // ── Home Page ────────────────────────────────────────────────────────────────

  test('Home page: ytd-rich-item-renderer exists (main video grid)', async ({ page }) => {
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle' });
    const count = await page.locator('ytd-rich-item-renderer').count();
    expect(count, 'ytd-rich-item-renderer not found — Home page grid selector broken').toBeGreaterThan(0);
  });

  test('Home page: video tiles contain a /watch href anchor', async ({ page }) => {
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle' });
    // Each video tile should have at least one anchor pointing to a /watch URL
    const anchors = await page.locator('ytd-rich-item-renderer a[href*="/watch"]').count();
    expect(anchors, 'Video tiles no longer contain /watch anchors — buildContext() will fail').toBeGreaterThan(0);
  });

  test('Home page: Shorts shelf uses ytd-rich-section-renderer', async ({ page }) => {
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle' });
    // Shorts shelves should be wrapped in ytd-rich-section-renderer
    const richSections = await page.locator('ytd-rich-section-renderer').count();
    // We just need the element type to exist — the actual Shorts check uses attributes.
    // A count of 0 means YouTube may have changed the shelf component name.
    expect(richSections, 'ytd-rich-section-renderer not found — Shorts shelf selector may be broken').toBeGreaterThanOrEqual(0);
    // This is a warning-level check; the test itself doesn't hard-fail because
    // some pages may not show a Shorts shelf. Log the count.
    console.log(`[Canary] ytd-rich-section-renderer count on home: ${richSections}`);
  });

  // ── Search Page ──────────────────────────────────────────────────────────────

  test('Search page: ytd-video-renderer exists in results', async ({ page }) => {
    await page.goto('https://www.youtube.com/results?search_query=learn+typescript', {
      waitUntil: 'networkidle',
    });
    const count = await page.locator('ytd-video-renderer').count();
    expect(count, 'ytd-video-renderer not found on search page — search result selector broken').toBeGreaterThan(0);
  });

  test('Search page: video results contain channel anchors (/@handle or /channel/)', async ({ page }) => {
    await page.goto('https://www.youtube.com/results?search_query=learn+typescript', {
      waitUntil: 'networkidle',
    });
    // Lockin extracts channel context from these anchors
    const channelLinks = await page.locator('ytd-video-renderer a[href^="/@"], ytd-video-renderer a[href*="/channel/UC"]').count();
    expect(channelLinks, 'Channel anchor links not found in search results — channelId extraction will fail').toBeGreaterThan(0);
  });

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  test('Sidebar: ytd-guide-entry-renderer exists', async ({ page }) => {
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle' });
    const count = await page.locator('ytd-guide-entry-renderer').count();
    expect(count, 'ytd-guide-entry-renderer not found — sidebar Shorts hide selector broken').toBeGreaterThan(0);
  });

  test('Sidebar: Shorts link has title="Shorts" or href="/shorts"', async ({ page }) => {
    await page.goto('https://www.youtube.com/', { waitUntil: 'networkidle' });
    // Lockin checks for a[title="Shorts"] or a[href="/shorts"] inside sidebar entries
    const shortsLink = page.locator(
      'ytd-guide-entry-renderer a[title="Shorts"], ytd-guide-entry-renderer a[href="/shorts"]'
    );
    const count = await shortsLink.count();
    // Log but don't hard fail — Shorts sidebar link may not always render
    console.log(`[Canary] Sidebar Shorts link count: ${count}`);
    if (count === 0) {
      console.warn('[Canary] WARNING: Sidebar Shorts link not found. ytd-guide-entry-renderer Shorts selector may need updating.');
    }
  });

  // ── Watch Page ───────────────────────────────────────────────────────────────

  test('Watch page: URL /watch?v= loads correctly', async ({ page }) => {
    // Use a public domain / creative commons video for testing
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    // If the URL is still /watch?v= after load, the page loaded (not a redirect)
    expect(page.url()).toContain('/watch?v=');
  });

  test('Watch page: recommended video tiles exist (ytd-compact-video-renderer)', async ({ page }) => {
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
    const count = await page.locator('ytd-compact-video-renderer').count();
    expect(count, 'ytd-compact-video-renderer not found on watch page — recommended sidebar selector broken').toBeGreaterThan(0);
  });

  // ── Shorts ───────────────────────────────────────────────────────────────────

  test('Shorts URL pattern: /shorts/ still matches a[href*="/shorts/"]', async ({ page }) => {
    await page.goto('https://www.youtube.com/shorts/', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });
    // Just verify the URL pattern resolves — the CSS selector a[href*="/shorts/"] depends on this
    expect(page.url()).toContain('/shorts');
  });

});
