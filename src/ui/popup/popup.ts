import {
  getStorage,
  addVideoToWhitelist,
  addPlaylistToWhitelist,
  removeVideoFromWhitelist,
  removePlaylistFromWhitelist,
  setVideoWhitelistName,
  setPlaylistWhitelistName,
} from '@/storage/index';
import { extractVideoIdFromUrl, extractPlaylistIdFromUrl } from '@/interception/classifier';
import type { WhitelistItem } from '@/storage/types';
import { buildYouTubeUrl, fetchYouTubeTitle } from '@/youtube/metadata';

let hasPassword = false;
let isHydratingNames = false;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderWhitelistItem(item: WhitelistItem, type: 'video' | 'playlist'): string {
  const href = buildYouTubeUrl(type, item.id);
  const displayName = item.name?.trim() || (type === 'video' ? `Video ${item.id}` : `Playlist ${item.id}`);

  return `
    <div class="list-item">
      <div class="item-content">
        <a href="${href}" target="_blank" rel="noopener" class="item-link" title="Open on YouTube">
          <span class="item-title">${escapeHtml(displayName)}</span>
          <span class="item-url">${escapeHtml(href)}</span>
        </a>
      </div>
      <button class="btn-remove" data-type="${type}" data-id="${escapeHtml(item.id)}" title="Remove from whitelist" aria-label="Remove ${type}">Remove</button>
    </div>
  `;
}

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
  const nameInput = document.getElementById('nameInput') as HTMLInputElement;

  addUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const typedName = nameInput.value.trim() || undefined;
    const videoId = extractVideoIdFromUrl(url);
    const playlistId = extractPlaylistIdFromUrl(url);

    if (videoId) {
      const name = typedName ?? await fetchYouTubeTitle('video', videoId);
      await addVideoToWhitelist(videoId, name);
      urlInput.value = '';
      nameInput.value = '';
      updateWhitelists();
    } else if (playlistId) {
      const name = typedName ?? await fetchYouTubeTitle('playlist', playlistId);
      await addPlaylistToWhitelist(playlistId, name);
      urlInput.value = '';
      nameInput.value = '';
      updateWhitelists();
    } else {
      alert('Could not extract video or playlist ID from URL');
    }
  });

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

  if (storage.whitelist.videos.length === 0) {
    videoList.innerHTML = '<p class="empty-state">No videos whitelisted yet</p>';
    videoCount.textContent = '0';
  } else {
    videoList.innerHTML = storage.whitelist.videos.map((item) => renderWhitelistItem(item, 'video')).join('');
    videoCount.textContent = storage.whitelist.videos.length.toString();
  }

  if (storage.whitelist.playlists.length === 0) {
    playlistList.innerHTML = '<p class="empty-state">No playlists whitelisted yet</p>';
    playlistCount.textContent = '0';
  } else {
    playlistList.innerHTML = storage.whitelist.playlists.map((item) => renderWhitelistItem(item, 'playlist')).join('');
    playlistCount.textContent = storage.whitelist.playlists.length.toString();
  }

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

  hydrateMissingWhitelistNames(storage.whitelist.videos, storage.whitelist.playlists);
}

async function hydrateMissingWhitelistNames(videos: WhitelistItem[], playlists: WhitelistItem[]) {
  if (isHydratingNames) {
    return;
  }

  const missingVideos = videos.filter(item => !item.name);
  const missingPlaylists = playlists.filter(item => !item.name);
  if (missingVideos.length === 0 && missingPlaylists.length === 0) {
    return;
  }

  isHydratingNames = true;
  let updated = false;

  try {
    for (const item of missingVideos) {
      const title = await fetchYouTubeTitle('video', item.id);
      if (title) {
        await setVideoWhitelistName(item.id, title);
        updated = true;
      }
    }

    for (const item of missingPlaylists) {
      const title = await fetchYouTubeTitle('playlist', item.id);
      if (title) {
        await setPlaylistWhitelistName(item.id, title);
        updated = true;
      }
    }
  } finally {
    isHydratingNames = false;
  }

  if (updated) {
    updateWhitelists();
  }
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
    unlockStatus.innerHTML = `<strong>Unlocked</strong> for ${minutes}m ${seconds}s`;
  }
}

initPopup();
