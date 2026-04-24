# Lockin Developer Guide

Welcome to the Lockin codebase! This guide is designed to help new contributors understand the architecture, data flow, and design patterns used in the extension.

## 🏗️ Architecture Overview

Lockin is a Chrome Extension (Manifest V3) built with **TypeScript**, **Vite**, and **React/Vanilla DOM**. It does not use background service workers for real-time traffic interception. Instead, it relies on an aggressive **Content Script** injected into YouTube pages.

### Core Architecture Components

1. **`src/ui/content/content.ts` (The Enforcer)**
   - Runs directly on `youtube.com`.
   - Responsible for constantly polling the current URL, checking it against the decision engine, and redirecting the user to the block page if the content is not allowed.
   - Responsible for CSS injection (hiding recommendations, comments, and shorts) when the user is in **Filtered Mode**.
   
2. **`src/ui/block/block.ts` (The Lockscreen)**
   - A standalone HTML page bundled into the extension.
   - Displayed when a user tries to access a blocked video.
   - Extracts metadata from the blocked URL (via `?from=...`) to display the thumbnail and title of what was blocked.

3. **`src/ui/popup/popup.ts` (The Control Center)**
   - The UI that opens when you click the extension icon in the Chrome toolbar.
   - Manages state via `chrome.storage`, including the whitelist, mode toggles, and cryptographic password handling.

4. **`src/core/engine.ts` (The Decision Pipeline)**
   - The brain of Lockin. It determines whether a specific YouTube URL should be `allow`ed or `block`ed based on the user's whitelist, active modes, and override timers.

---

## 🧠 The Decision Engine (`src/core/engine.ts`)

To ensure testability and isolation, the blocking logic is decoupled from Chrome APIs and DOM manipulation. It uses a **Producer-Resolver** pattern.

### 1. Producers
Producers are pure functions that analyze the current URL context and generate **signals**. 
- `WhitelistProducer`: Emits `whitelist:match` if the video/playlist/channel ID matches the user's whitelist.
- `OverrideProducer`: Emits `override:active` or `override:disabled` based on temporary unlock timers.
- `ModeProducer`: Emits `mode:strict` or `mode:filtered`.
- `KeywordProducer`: Emits `keyword:block:*` or `keyword:allow:*` by dynamically fetching video metadata and comparing it against configured word lists.

### 2. The Resolver
The `DefaultResolver` takes all the generated signals and decides the final action.
- Priority: `Disabled > Override Active > Whitelist Match > Keyword Match > Default Deny`.

### Why this pattern?
By keeping Producers and Resolvers as pure functions, we can test the entire blocking matrix instantly via Vitest without needing to mock Chrome browser APIs.

---

## 🔐 Security & Cryptography (`src/core/crypto.ts`)

Lockin intentionally makes it difficult to disable the blocker to prevent impulsive relapses.
- We use the native **Web Crypto API** (`PBKDF2-HMAC-SHA256`).
- When a user sets a password, we generate a random `Uint8Array` salt.
- The password is hashed 100,000 times.
- Both the `salt` and the `hash` are stored in `chrome.storage.local`. 
- **The plain-text password is never stored.** 
- If a user tries to manually edit `chrome.storage` to disable the blocker, the signature will fail, and the extension will fail-closed (remain blocked).

---

## 💾 Storage Layer (`src/storage/index.ts`)

Lockin uses a dual-storage approach:
1. **`chrome.storage.sync`**: Used for the user's Whitelist, Mode preference, and Settings. This allows the user's study configurations to sync across multiple computers signed into Chrome.
2. **`chrome.storage.local`**: Used for the `OverrideState` (temporary unlocks) and `SecurityData` (password hashes). We do not sync these because an active override on a laptop shouldn't automatically unlock YouTube on a desktop.

*Important:* All storage interactions are strictly typed using the schemas defined in `src/storage/types.ts`.

---

## 🧪 Testing

We use **Vitest** for incredibly fast, isolated unit testing.

### Running Tests
```bash
npm run test
```

### Writing Tests
- **Engine Tests (`src/core/engine.test.ts`)**: When modifying the resolver logic or adding new URL edge cases, always add a row to the `decide() regression matrix`.
- **Producer Tests (`src/core/producers.test.ts`)**: Test new producers in total isolation. Mock the `DecisionInput` context manually.

---

## 🚀 Adding a New Feature (Example: New Block Condition)

If you want to add a feature like "Block all videos published in the last 24 hours":
1. Create a new producer in `src/decision/producers/`.
2. Have it emit a signal like `time:recent:block`.
3. Add the producer to the `DefaultProducers` array in `engine.ts`.
4. Update the `DefaultResolver` to handle the priority of the new `time:recent:block` signal.
5. Add unit tests for the producer and integration tests for the resolver matrix.

Happy coding! Keep the codebase minimal, fast, and focused.
