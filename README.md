<div align="center">
  <img src="public/logo.png" alt="Lockin Logo" width="128" height="128" style="border-radius: 20px" />
  <h1>Lockin</h1>
  <p><strong>Stay completely focused and locked in by turning YouTube into a highly intentional learning tool.</strong></p>
</div>

---

## 🎯 What is Lockin?

YouTube is packed with extremely valuable educational content, but it's deliberately engineered to side-track you with highly addictive short-form videos and irrelevant recommendations. 

**Lockin** is a purpose-built Chrome Extension designed to take back your attention. Instead of completely blocking YouTube out of your life, Lockin explicitly disables the general algorithm and forces you to pre-define the exact videos or playlists you are allowed to watch. If a video is not on your whitelist, you simply cannot view it. 

### ✨ Features
- **Strict Video Whitelisting**: Only allow explicit educational or necessary videos to play.
- **Playlist Unlocking**: Whitelist entire playlists securely. 
- **The Lockscreen**: A beautiful, minimal distraction-free block screen with a live responsive analog clock designed to anchor you back to reality.
- **Password Locking**: Optionally safeguard your whitelist settings by requiring a passcode to change overrides.
- **Temporary Bypasses**: Give yourself a quick 2-min, 5-min, or 10-min bypass when you legitimately need to break focus for a bit.

---

## 🛠️ Tech Stack & Architecture
- **Framework**: Minimal vanilla TypeScript & HTML.
- **Bundler**: Built with [Vite](https://vitejs.dev/) and powered by `@crxjs/vite-plugin` for seamless hot-reloading in Chrome Extension environments.
- **Styling**: Hand-crafted CSS engineered for perfect minimal aesthetics.

---

## 🚀 Getting Started for Development

Do you want to run Lockin locally or contribute to the project? Setup is fast and simple.

### Prerequisites
- [Node.js](https://nodejs.org/en/) (Version 16+ highly recommended)
- Git 

### 1. Installation
Clone the repository to your local machine and install the dependencies:
```bash
git clone https://github.com/Akshansh-Sinha/Lockin-YoutubeBlocker-Extension.git
cd Lockin-YoutubeBlocker-Extension
npm install
```

### 2. Building the Project
To compile the TypeScript framework and package everything into the static `dist/` directory, simply run:
```bash
npm run build
```

---

## 📦 Loading the Extension into Chrome

Because this is a locally built developer setup, you must manually load it into your Chrome browser:

1. Open your browser and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `dist` folder located inside your cloned `Lockin-YoutubeBlocker-Extension` directory.
5. Setup complete! The extension should successfully boot up in your toolbar.

> **Note on Updates**: Any time you pull new code or run `npm run build`, you may need to navigate back to `chrome://extensions` and explicitly press the circular "Reload" icon to bypass aggressive web caching! 

---

## 💡 Usage Workflow
By default, immediately after enabling Lockin, navigating to YouTube will instantly be intercepted by the block screen. To use it intentionally:
1. Click the Lockin icon inside your browser toolbar.
2. Under "Add link", paste the URL to the exact video or playlist you need to study.
3. Once added, your video will seamlessly bypass the locker!
