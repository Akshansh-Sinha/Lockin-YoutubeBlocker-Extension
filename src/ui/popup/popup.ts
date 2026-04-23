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
  addChannelToWhitelist,
  removeChannelFromWhitelist,
  setMode,
} from '@/storage/index';
import { extractVideoIdFromUrl, extractPlaylistIdFromUrl } from '@/interception/classifier';
import { extractContext } from '@/core/engine';
import type { WhitelistItem, Mode } from '@/storage/types';
import { buildYouTubeUrl, fetchYouTubeTitle } from '@/youtube/metadata';

let isHydratingNames = false;
const DISABLE_CHALLENGE_ANSWER = 'i have completed my studies';

function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
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
    });
  });

  updateModeToggle((await getStorage()).mode);

  // ── Preset unlock buttons ──────────────────────────────────────────────────
  const presetButtons = document.querySelectorAll('.btn-preset') as NodeListOf<HTMLButtonElement>;
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const minutesStr = btn.dataset.minutes;
      if (!minutesStr) {
        return;
      }
      const minutes = minutesStr ? parseInt(minutesStr, 10) : 10;
      const unlockUntil = Date.now() + minutes * 60 * 1000;

      await setOverrideExpiry(unlockUntil);

      updateUnlockStatus();
    });
  });

  disableBtn.addEventListener('click', async () => {
    const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
    if (challenge.style.display === 'block') {
      await confirmDisable();
    } else {
      await showDisableChallenge();
    }
  });

  enableBtn.addEventListener('click', async () => {
    await setBlockingDisabled(false);
    hideDisableChallenge();
    updateUnlockStatus();
  });

  confirmDisableBtn.addEventListener('click', confirmDisable);

  cancelDisableBtn.addEventListener('click', hideDisableChallenge);

  updateUnlockStatus();
  setInterval(updateUnlockStatus, 1000);
}

async function showDisableChallenge() {
  const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
  const question = document.getElementById('challengeQuestion') as HTMLElement;
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;

  answerInput.type = 'text';
  answerInput.value = '';
  error.textContent = '';

  question.textContent = 'Type "I have completed my studies" to disable blocking.';

  challenge.style.display = 'block';
  answerInput.focus();
}

async function confirmDisable() {
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;
  const answer = normalizeAnswer(answerInput.value);

  if (answer !== DISABLE_CHALLENGE_ANSWER) {
    error.textContent = 'Type the exact phrase to disable blocking.';
    return;
  }

  await setBlockingDisabled(true);
  hideDisableChallenge();
  updateUnlockStatus();
}

function hideDisableChallenge() {
  const challenge = document.getElementById('disableChallenge') as HTMLDivElement;
  const answerInput = document.getElementById('challengeAnswer') as HTMLInputElement;
  const error = document.getElementById('challengeError') as HTMLElement;

  answerInput.value = '';
  error.textContent = '';
  challenge.style.display = 'none';
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
