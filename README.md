# Lockin

Turn YouTube into a controlled learning tool. Only pre-approved videos and playlists are accessible; everything else is blocked.

## Quick Start

### Install dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts Vite in watch mode. Open Chrome to `chrome://extensions`, enable **Developer mode**, and click **Load unpacked** → select the `dist/` folder.

### Build for production

```bash
npm run build
```

Outputs to `dist/`, ready to zip and upload to Chrome Web Store.

### Run tests

```bash
npm test
```

## How to use

1. **First run:** Open the popup (click the extension icon), set a password.
2. **Whitelist videos:** Paste a YouTube video URL in the popup or click "Add to whitelist" on the block page.
3. **Unlock (override):** Click "Unlock for N minutes" in the popup, enter your password. All YouTube URLs are allowed during the override window.
4. **Block page:** Non-whitelisted URLs redirect here with a "Add to whitelist" link (if it's a video/playlist) or a back button.

## Architecture

See `ARCHITECTURE.md` for module boundaries, data flow, and storage schema.

## Limitations

- **Not a security boundary:** A motivated user can disable the extension from `chrome://extensions`. Lockin is a focus tool, not a parental control.
- **Phase 1 is strict:** Only exact video/playlist IDs are whitelisted. Future phases will add keyword filtering and semantic relevance scoring.

## Roadmap

See `ROADMAP.md` for phase checklist and acceptance criteria.

## Development notes

- **TypeScript + Vite + CRXJS** for the build.
- **Manifest V3** service worker, no remote code execution.
- **Privacy first:** No network calls, no analytics, no telemetry by default.
- See `DECISIONS.md` for build choices.
