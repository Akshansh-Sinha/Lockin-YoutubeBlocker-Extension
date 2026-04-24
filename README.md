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
- **Strict Video Whitelisting**: Only allow explicit educational or necessary videos, playlists, or channels to play.
- **Dual Modes (Strict vs. Filtered)**: Choose to block the entire website aggressively (Strict), or just block distracting recommendations/shorts while leaving navigation open (Filtered).
- **Cryptographic Password Lock**: Secure the extension with a custom password. You must enter it to disable blocking or use bypasses, preventing impulsive late-night unlocks.
- **The Lockscreen**: A beautiful, minimal distraction-free block screen with a live responsive analog clock designed to anchor you back to reality.
- **Temporary Bypasses**: Give yourself a quick 2-min, 5-min, or 10-min bypass when you legitimately need to break focus (secured by your password).

## 📸 Screenshot

![Lockin Block Screen](docs/screenshot.png)

---

## 🛠️ Tech Stack & Architecture
- **Framework**: Minimal vanilla TypeScript & HTML.
- **Bundler**: Built with [Vite](https://vitejs.dev/) and powered by `@crxjs/vite-plugin` for seamless hot-reloading in Chrome Extension environments.
- **Styling**: Hand-crafted CSS engineered for perfect minimal aesthetics.
- **Testing**: Robust test suite powered by [Vitest](https://vitest.dev/).

> 🧑‍💻 **Developers:** Check out the [Developer Guide](DEVELOPER_GUIDE.md) for an in-depth breakdown of the codebase architecture, decision engine, and how to contribute!

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
*(To watch for changes during development, you can use `npm run dev`)*

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

## 💡 Detailed Usage Workflow

Lockin uses an aggressive default-deny approach: the moment you enable it, **the entire YouTube algorithm is locked.** If you surf to `youtube.com`, you will instantly be met with the Lockin interface. 

To use YouTube intentionally, follow these steps to manage your study sessions effectively:

### 1. Initial Setup
When you first open the Lockin popup, you will be prompted to set a **Password**. This password acts as your final defense against impulsively turning the blocker off. 

### 2. Whitelisting Specific Content
You can whitelist any URL directly from YouTube, whether it is a singular educational video, an entire playlist, or an educational channel.
- Copy the exact YouTube web URL or channel handle (e.g., `@Fireship`).
- Open the Lockin popup from your toolbar.
- In the **Add link** section, paste the URL or handle.
- Once added, that content is officially approved. By clicking on items inside the popup list, Lockin will safely bypass the block screen and drop you right into the video.

### 3. Strict vs. Filtered Mode
- **Strict Mode:** Blocks EVERYTHING on YouTube except the exact URLs you whitelisted.
- **Filtered Mode:** Allows you to freely browse YouTube, but ruthlessly deletes/hides all Recommendations, Comments, and Shorts from the screen using CSS injection.

### 4. Temporary Unlocks
If you genuinely need to explore the platform to research something or take a brief break, use a **Temporary Unlock**.
- Inside the extension UI, locate the **Temporary unlock** section.
- Click either **2 min**, **5 min**, or **10 min**. 
- Enter your password to authorize the unlock. The entire YouTube website will be functionally unlocked for that strict window. 

### 5. Overriding & Disabling
If you are done studying for the day and want to turn Lockin off completely:
- Hit the red **Disable** button inside the extension popup.
- Enter your password.
- You can instantly re-enable the blocker anytime via the **Enable blocking** button!
