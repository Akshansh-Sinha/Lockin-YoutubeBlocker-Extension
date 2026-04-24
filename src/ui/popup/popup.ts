import {
  getStorage,
  addVideoToWhitelist,
  addPlaylistToWhitelist,
  removeVideoFromWhitelist,
  removePlaylistFromWhitelist,
  setVideoWhitelistName,
  setPlaylistWhitelistName,
  setOverrideExpiry,
  setBlockingDisabled,
  setPasswordHash,
  addChannelToWhitelist,
  removeChannelFromWhitelist,
  setMode,
} from '@/storage/index';
import { extractVideoIdFromUrl, extractPlaylistIdFromUrl } from '@/interception/classifier';
import { extractContext } from '@/core/engine';
import type { WhitelistItem, Mode } from '@/storage/types';
import { buildYouTubeUrl, fetchYouTubeTitle } from '@/youtube/metadata';
import { generateSalt, hashPassword, verifyPassword } from '@/core/crypto';

let isHydratingNames = false;

const BLOCK_PAGE_URL = chrome.runtime.getURL('src/ui/block/index.html');

/**
 * After an override/mode change, navigate the user back to YouTube.
 *
 * Priority:
 *  1. Active tab is the block page → extract the original URL from ?from= and go there.
 *  2. Active tab is a YouTube tab  → reload it so the content script re-initialises.
 *  3. Fallback: find any open YouTube tab and reload it.
 */
async function navigateAfterOverride(): Promise<void> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (tab?.id && tab.url) {
    // ── Case 1: currently on the block page ───────────────────────────────
    if (tab.url.startsWith(BLOCK_PAGE_URL)) {
      try {
        const params = new URL(tab.url).searchParams;
        const originalUrl = params.get('from');
        if (originalUrl) {
          await chrome.tabs.update(tab.id, { url: decodeURIComponent(originalUrl) });
          return;
        }
      } catch {
        // Malformed URL — fall through to reload
      }
      // No from= param; just go to YouTube home
      await chrome.tabs.update(tab.id, { url: 'https://www.youtube.com/' });
      return;
    }

    // ── Case 2: already on a YouTube tab ────────────────────────────────
    if (tab.url.includes('youtube.com')) {
      await chrome.tabs.reload(tab.id);
      return;
    }
  }

  // ── Case 3: popup opened from a non-YT tab — find any YouTube tab ───
  const ytTabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
  for (const t of ytTabs) {
    if (t.id) await chrome.tabs.reload(t.id);
  }
}



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

function renderChannelItem(item: WhitelistItem): string {
  const displayName = item.name?.trim() || item.id;
  const href = item.id.startsWith('@')
    ? `https://www.youtube.com/${item.id}`
    : `https://www.youtube.com/channel/${item.id}`;

  return `
    <div class="list-item">
      <div class="item-content">
        <a href="${href}" target="_blank" rel="noopener" class="item-link" title="Open on YouTube">
          <span class="item-title">${escapeHtml(displayName)}</span>
          <span class="item-url">${escapeHtml(item.id)}</span>
        </a>
      </div>
      <button class="btn-remove" data-type="channel" data-id="${escapeHtml(item.id)}" title="Remove from whitelist" aria-label="Remove channel">Remove</button>
    </div>
  `;
}

async function initPopup() {
  await getStorage();
  showMainUI();
}

async function showMainUI() {
  const mainUI = document.getElementById('mainUI') as HTMLDivElement;
  mainUI.style.display = 'block';

  updateWhitelists();

  const addUrlBtn = document.getElementById('addUrlBtn') as HTMLButtonElement;
  const urlInput = document.getElementById('urlInput') as HTMLInputElement;
  const nameInput = document.getElementById('nameInput') as HTMLInputElement;
  const disableBtn = document.getElementById('disableBtn') as HTMLButtonElement;
  const enableBtn = document.getElementById('enableBtn') as HTMLButtonElement;
  const confirmDisableBtn = document.getElementById('confirmDisableBtn') as HTMLButtonElement;
  const cancelDisableBtn = document.getElementById('cancelDisableBtn') as HTMLButtonElement;

  const setupUI = document.getElementById('setupUI') as HTMLDivElement;
  const newPasswordInput = document.getElementById('newPasswordInput') as HTMLInputElement;
  const savePasswordBtn = document.getElementById('savePasswordBtn') as HTMLButtonElement;
  const setPasswordStatus = document.getElementById('setPasswordStatus') as HTMLParagraphElement;
  const toggleNewPassword = document.getElementById('toggleNewPassword') as HTMLButtonElement;

  // Render Set Password section if no password is set
  const storage = await getStorage();
  if (!storage.security.passwordHash) {
    setupUI.style.display = 'block';
    mainUI.style.display = 'none';
  } else {
    setupUI.style.display = 'none';
    mainUI.style.display = 'block';
  }

  toggleNewPassword.addEventListener('click', () => {
    newPasswordInput.type = newPasswordInput.type === 'password' ? 'text' : 'password';
  });

  savePasswordBtn.addEventListener('click', async () => {
    const pwd = newPasswordInput.value;
    if (pwd.length < 4) {
      setPasswordStatus.style.color = '#e74c3c';
      setPasswordStatus.textContent = 'Password must be at least 4 characters.';
      return;
    }
    const salt = generateSalt();
    const hash = await hashPassword(pwd, salt);
    await setPasswordHash(hash, salt);
    
    // Switch to main UI
    setupUI.style.display = 'none';
    mainUI.style.display = 'block';
    
    newPasswordInput.value = '';
    setPasswordStatus.textContent = '';
  });

  // ── URL detection feedback ────────────────────────────────────────────────────
  const urlDetectionHint = document.createElement('p');
  urlDetectionHint.className = 'url-detection-hint';
  urlDetectionHint.style.cssText = 'margin-top: 6px; font-size: 12px; color: #666; min-height: 16px;';
  urlInput.parentElement?.parentElement?.insertBefore(urlDetectionHint, urlInput.parentElement.nextSibling);

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (!url) {
      urlDetectionHint.textContent = '';
      return;
    }
    const videoId = extractVideoIdFromUrl(url);
    const playlistId = extractPlaylistIdFromUrl(url);

    if (videoId) {
      urlDetectionHint.textContent = '✓ Video detected - will add to Videos';
      urlDetectionHint.style.color = '#2ecc71';
    } else if (playlistId) {
      urlDetectionHint.textContent = '✓ Playlist detected - will add to Playlists';
      urlDetectionHint.style.color = '#2ecc71';
    } else {
      urlDetectionHint.textContent = '⚠ No video or playlist detected';
      urlDetectionHint.style.color = '#e74c3c';
    }
  });

  addUrlBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const typedName = nameInput.value.trim() || undefined;
    const videoId = extractVideoIdFromUrl(url);
    const playlistId = extractPlaylistIdFromUrl(url);

    // Priority: if it's a youtu.be or /watch URL with video, always add as VIDEO (not playlist)
    // This prevents accidental playlist additions when copying video links from playlists
    if (videoId) {
      const name = typedName ?? await fetchYouTubeTitle('video', videoId);
      await addVideoToWhitelist(videoId, name);
      urlInput.value = '';
      nameInput.value = '';
      urlDetectionHint.textContent = '';
      updateWhitelists();
    } else if (playlistId) {
      // Only add as playlist if there's NO video ID
      const name = typedName ?? await fetchYouTubeTitle('playlist', playlistId);
      await addPlaylistToWhitelist(playlistId, name);
      urlInput.value = '';
      nameInput.value = '';
      urlDetectionHint.textContent = '';
      updateWhitelists();
    } else {
      alert('Could not extract video or playlist ID from URL');
    }
  });

  // ── Channel input ──────────────────────────────────────────────────────────
  const channelInput = document.getElementById('channelInput') as HTMLInputElement;
  const addChannelBtn = document.getElementById('addChannelBtn') as HTMLButtonElement;

  addChannelBtn.addEventListener('click', async () => {
    const raw = channelInput.value.trim();
    const channelError = document.getElementById('channelError') as HTMLElement;
    channelError.style.display = 'none';

    if (!raw) return;

    let channelId: string | null = null;

    if (raw.startsWith('@')) {
      channelId = raw;
    } else if (raw.startsWith('UC') && !raw.includes('/')) {
      channelId = raw;
    } else {
      const ctx = extractContext(raw.includes('://') ? raw : `https://www.youtube.com/${raw}`);
      channelId = ctx.channelId;
    }

    if (!channelId) {
      channelError.style.display = 'block';
      return;
    }

    await addChannelToWhitelist({ id: channelId, name: channelId });
    channelInput.value = '';
    updateWhitelists();
  });

  // ── Mode toggle ────────────────────────────────────────────────────────────
  const modeStrict = document.getElementById('modeStrict') as HTMLButtonElement;
  const modeFiltered = document.getElementById('modeFiltered') as HTMLButtonElement;

  [modeStrict, modeFiltered].forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newMode = btn.dataset.mode as 'strict' | 'filtered';
      await setMode(newMode);
      updateModeToggle(newMode);
      // Reload the YouTube tab so the new mode activates immediately.
      await navigateAfterOverride();
    });
  });

  updateModeToggle((await getStorage()).mode);

  // ── Preset unlock buttons ──────────────────────────────────────────────────
  const presetButtons = document.querySelectorAll('.btn-preset[data-minutes]') as NodeListOf<HTMLButtonElement>;
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const minutesStr = btn.dataset.minutes;
      if (!minutesStr) {
        return;
      }
      const minutes = minutesStr ? parseInt(minutesStr, 10) : 10;
      const unlockUntil = Date.now() + minutes * 60 * 1000;

      const storage = await getStorage();
      if (storage.security.passwordHash) {
        // Must provide password to unlock if set
        await showDisableChallenge(async () => {
          await setOverrideExpiry(unlockUntil);
          updateUnlockStatus();
          await navigateAfterOverride();
        });
      } else {
        await setOverrideExpiry(unlockUntil);
        updateUnlockStatus();
        await navigateAfterOverride();
      }
    });
  });

  disableBtn.addEventListener('click', async () => {
    const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
    if (challenge.style.display === 'block') {
      const pendingCb = (window as any)._pendingDisableCb;
      if (pendingCb) {
        await confirmDisable(pendingCb);
      } else {
        await confirmDisable(async () => {
          await setBlockingDisabled(true);
          hideDisableChallenge();
          updateUnlockStatus();
          await navigateAfterOverride();
        });
      }
    } else {
      const storage = await getStorage();
      if (!storage.security.passwordHash) {
        // No password set, just disable directly
        await setBlockingDisabled(true);
        updateUnlockStatus();
        await navigateAfterOverride();
      } else {
        await showDisableChallenge(async () => {
          await setBlockingDisabled(true);
          hideDisableChallenge();
          updateUnlockStatus();
          await navigateAfterOverride();
        });
      }
    }
  });

  enableBtn.addEventListener('click', async () => {
    await setBlockingDisabled(false);
    hideDisableChallenge();
    updateUnlockStatus();
    // Re-enable blocking: reload so the content script starts with blocking active.
    await navigateAfterOverride();
  });

  confirmDisableBtn.addEventListener('click', async () => {
    const pendingCb = (window as any)._pendingDisableCb;
    if (pendingCb) {
      await confirmDisable(pendingCb);
    } else {
      await confirmDisable(async () => {
        await setBlockingDisabled(true);
        hideDisableChallenge();
        updateUnlockStatus();
        await navigateAfterOverride();
      });
    }
  });

  cancelDisableBtn.addEventListener('click', hideDisableChallenge);

  const toggleChallengePassword = document.getElementById('toggleChallengePassword') as HTMLButtonElement;
  const challengeAnswer = document.getElementById('challengeAnswer') as HTMLInputElement;
  toggleChallengePassword.addEventListener('click', () => {
    challengeAnswer.type = challengeAnswer.type === 'password' ? 'text' : 'password';
  });

  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn') as HTMLButtonElement;
  const resetConfirmChallenge = document.getElementById('resetConfirmChallenge') as HTMLDivElement;
  const confirmResetBtn = document.getElementById('confirmResetBtn') as HTMLButtonElement;
  const cancelResetBtn = document.getElementById('cancelResetBtn') as HTMLButtonElement;

  forgotPasswordBtn.addEventListener('click', () => {
    document.getElementById('disableChallenge')!.style.display = 'none';
    resetConfirmChallenge.style.display = 'block';
  });

  cancelResetBtn.addEventListener('click', () => {
    resetConfirmChallenge.style.display = 'none';
    document.getElementById('disableChallenge')!.style.display = 'block';
  });

  confirmResetBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    // Re-initialize completely
    window.location.reload();
  });

  updateUnlockStatus();
  setInterval(updateUnlockStatus, 1000);
}

async function showDisableChallenge(onSuccess: () => Promise<void>) {
  const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
  const question = document.getElementById('challengeQuestion') as HTMLElement;
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;

  answerInput.type = 'password';
  answerInput.value = '';
  error.textContent = '';

  question.textContent = 'Enter your password to unlock:';

  // Store the callback so confirmDisable knows what to do on success
  (window as any)._pendingDisableCb = onSuccess;

  challenge.style.display = 'block';
  answerInput.focus();
}

async function confirmDisable(onSuccess: () => Promise<void>) {
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;
  const password = answerInput.value;

  const storage = await getStorage();
  if (storage.security.passwordHash && storage.security.salt) {
    const isValid = await verifyPassword(password, storage.security.passwordHash, storage.security.salt);
    if (!isValid) {
      error.textContent = 'Incorrect password.';
      return;
    }
  }

  // Clear callback
  (window as any)._pendingDisableCb = null;

  hideDisableChallenge();
  await onSuccess();
}

function hideDisableChallenge() {
  const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;

  answerInput.value = '';
  error.textContent = '';
  challenge.style.display = 'none';
  (window as any)._pendingDisableCb = null;
}

async function updateWhitelists() {
  const storage = await getStorage();

  const videoList = document.getElementById('videoList') as HTMLDivElement;
  const playlistList = document.getElementById('playlistList') as HTMLDivElement;
  const channelList = document.getElementById('channelList') as HTMLDivElement;
  const videoCount = document.getElementById('videoCount') as HTMLElement;
  const playlistCount = document.getElementById('playlistCount') as HTMLElement;
  const channelCount = document.getElementById('channelCount') as HTMLElement;

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

  if (storage.whitelist.channels.length === 0) {
    channelList.innerHTML = '<p class="empty-state">No channels whitelisted yet</p>';
    channelCount.textContent = '0';
  } else {
    channelList.innerHTML = storage.whitelist.channels.map(renderChannelItem).join('');
    channelCount.textContent = storage.whitelist.channels.length.toString();
  }

  document.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLButtonElement;
      const type = target.dataset.type ?? '';
      const id = target.dataset.id ?? '';

      if (type === 'video') {
        await removeVideoFromWhitelist(id);
      } else if (type === 'playlist') {
        await removePlaylistFromWhitelist(id);
      } else if (type === 'channel') {
        await removeChannelFromWhitelist(id);
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
  const disableBtn = document.getElementById('disableBtn') as HTMLButtonElement;
  const enableBtn = document.getElementById('enableBtn') as HTMLButtonElement;
  const now = Date.now();

  if (storage.override.disabled) {
    unlockStatus.textContent = 'Blocking disabled';
    disableBtn.style.display = 'none';
    enableBtn.style.display = 'block';
  } else if (storage.override.activeUntil === null || storage.override.activeUntil < now) {
    unlockStatus.textContent = '';
    disableBtn.style.display = 'block';
    enableBtn.style.display = 'none';
  } else {
    const remainingMs = storage.override.activeUntil - now;
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    unlockStatus.innerHTML = `<strong>Unlocked</strong> for ${minutes}m ${seconds}s`;
    disableBtn.style.display = 'block';
    enableBtn.style.display = 'none';
  }
}

function updateModeToggle(mode: Mode): void {
  const modeStrict = document.getElementById('modeStrict') as HTMLButtonElement;
  const modeFiltered = document.getElementById('modeFiltered') as HTMLButtonElement;
  const modeHint = document.getElementById('modeHint') as HTMLElement;
  const shortsNotice = document.getElementById('shortsNotice') as HTMLElement;
  const channelsSection = document.getElementById('channelsSection') as HTMLElement;
  const channelInputGroup = document.getElementById('channelInputGroup') as HTMLElement;

  const isFiltered = mode === 'filtered';

  modeStrict.classList.toggle('active', !isFiltered);
  modeFiltered.classList.toggle('active', isFiltered);

  modeHint.textContent = isFiltered
    ? 'YouTube loads normally — non-whitelisted tiles are hidden in place.'
    : 'All non-whitelisted URLs redirect to the block page.';

  shortsNotice.style.display = isFiltered ? 'block' : 'none';
  channelsSection.style.display = isFiltered ? 'block' : 'none';
  channelInputGroup.style.display = isFiltered ? 'flex' : 'none';
}

initPopup();
