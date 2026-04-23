import { getStorage, addVideoToWhitelist, addPlaylistToWhitelist, removeVideoFromWhitelist, removePlaylistFromWhitelist } from '@/storage/index';
import { extractVideoIdFromUrl, extractPlaylistIdFromUrl } from '@/interception/classifier';

let hasPassword = false;

async function initPopup() {
  const storage = await getStorage();
  hasPassword = storage.security.passwordHash !== null;

  if (!hasPassword) {
    showFirstRun();
  } else {
    showMainUI();
  }
}

function showFirstRun() {
  const setupDiv = document.getElementById('firstRunSetup') as HTMLDivElement;
  setupDiv.style.display = 'block';

  const setupBtn = document.getElementById('setupBtn') as HTMLButtonElement;
  const passwordInput = document.getElementById('setupPassword') as HTMLInputElement;
  const confirmInput = document.getElementById('setupPasswordConfirm') as HTMLInputElement;

  setupBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = btoa(String.fromCharCode(...salt));

    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const key = await crypto.subtle.importKey('raw', data, 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256
    );

    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash)));

    const storage = await getStorage();
    storage.security.passwordHash = hashBase64;
    storage.security.salt = saltBase64;
    await chrome.storage.local.set(storage);

    hasPassword = true;
    setupDiv.style.display = 'none';
    showMainUI();
  });
}

async function showMainUI() {
  const mainUI = document.getElementById('mainUI') as HTMLDivElement;
  mainUI.style.display = 'block';

  updateWhitelists();

  const addUrlBtn = document.getElementById('addUrlBtn') as HTMLButtonElement;
  const urlInput = document.getElementById('urlInput') as HTMLInputElement;

  addUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const videoId = extractVideoIdFromUrl(url);
    const playlistId = extractPlaylistIdFromUrl(url);

    if (videoId) {
      await addVideoToWhitelist(videoId);
      urlInput.value = '';
      updateWhitelists();
    } else if (playlistId) {
      await addPlaylistToWhitelist(playlistId);
      urlInput.value = '';
      updateWhitelists();
    } else {
      alert('Could not extract video or playlist ID from URL');
    }
  });

  // Unlock presets
  const presetButtons = document.querySelectorAll('.btn-preset') as NodeListOf<HTMLButtonElement>;
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const minutesStr = btn.dataset.minutes;
      const minutes = minutesStr ? parseInt(minutesStr, 10) : 10;
      const unlockUntil = Date.now() + minutes * 60 * 1000;

      const storage = await getStorage();
      storage.override.activeUntil = unlockUntil;
      await chrome.storage.local.set(storage);

      updateUnlockStatus();
    });
  });

  updateUnlockStatus();
  setInterval(updateUnlockStatus, 1000);
}

async function updateWhitelists() {
  const storage = await getStorage();

  const videoList = document.getElementById('videoList') as HTMLDivElement;
  const playlistList = document.getElementById('playlistList') as HTMLDivElement;
  const videoCount = document.getElementById('videoCount') as HTMLElement;
  const playlistCount = document.getElementById('playlistCount') as HTMLElement;

  // Videos
  if (storage.whitelist.videos.length === 0) {
    videoList.innerHTML = '<p class="empty-state">No videos whitelisted yet</p>';
    videoCount.textContent = '0';
  } else {
    videoList.innerHTML = storage.whitelist.videos
      .map(
        (id) => `
      <div class="list-item">
        <div class="item-content">
          <a href="https://youtube.com/watch?v=${encodeURIComponent(id)}" target="_blank" rel="noopener" class="item-link" title="Watch on YouTube">
            <span class="item-id">${id}</span>
            <span class="link-icon">↗</span>
          </a>
        </div>
        <button class="btn-remove" data-type="video" data-id="${id}" title="Remove from whitelist">✕</button>
      </div>
    `
      )
      .join('');
    videoCount.textContent = storage.whitelist.videos.length.toString();
  }

  // Playlists
  if (storage.whitelist.playlists.length === 0) {
    playlistList.innerHTML = '<p class="empty-state">No playlists whitelisted yet</p>';
    playlistCount.textContent = '0';
  } else {
    playlistList.innerHTML = storage.whitelist.playlists
      .map(
        (id) => `
      <div class="list-item">
        <div class="item-content">
          <a href="https://youtube.com/playlist?list=${encodeURIComponent(id)}" target="_blank" rel="noopener" class="item-link" title="Watch on YouTube">
            <span class="item-id">${id}</span>
            <span class="link-icon">↗</span>
          </a>
        </div>
        <button class="btn-remove" data-type="playlist" data-id="${id}" title="Remove from whitelist">✕</button>
      </div>
    `
      )
      .join('');
    playlistCount.textContent = storage.whitelist.playlists.length.toString();
  }

  // Add remove listeners
  document.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const type = target.dataset.type || '';
      const id = target.dataset.id || '';

      if (type === 'video') {
        await removeVideoFromWhitelist(id);
      } else if (type === 'playlist') {
        await removePlaylistFromWhitelist(id);
      }

      updateWhitelists();
    });
  });
}

async function updateUnlockStatus() {
  const storage = await getStorage();
  const unlockStatus = document.getElementById('unlockStatus') as HTMLDivElement;
  const now = Date.now();

  if (storage.override.activeUntil === null || storage.override.activeUntil < now) {
    unlockStatus.textContent = '';
  } else {
    const remainingMs = storage.override.activeUntil - now;
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    unlockStatus.innerHTML = `🔓 <strong>Unlocked</strong> for ${minutes}m ${seconds}s`;
  }
}

initPopup();
