import { ensureBlockingSessionStarted, getStorage } from '@/storage/index';
import type { WhitelistItem } from '@/storage/types';
import { buildYouTubeUrl, type YouTubeEntryType } from '@/youtube/metadata';

function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDisplayName(item: WhitelistItem, type: YouTubeEntryType): string {
  return item.name?.trim() || (type === 'video' ? `Video ${item.id}` : `Playlist ${item.id}`);
}

function renderRow(item: WhitelistItem, type: YouTubeEntryType): string {
  const href = buildYouTubeUrl(type, item.id);

  return `
    <tr>
      <td>${escapeHtml(getDisplayName(item, type))}</td>
      <td>${type === 'video' ? 'Video' : 'Playlist'}</td>
      <td class="link-cell">
        <a href="${escapeHtml(href)}">${escapeHtml(href)}</a>
      </td>
    </tr>
  `;
}



async function startBlockTimer() {
  const analogTimer = document.getElementById('analogTimer');
  const hourHand = document.getElementById('hourHand');
  const minuteHand = document.getElementById('minuteHand');
  const secondHand = document.getElementById('secondHand');

  if (!analogTimer || !hourHand || !minuteHand || !secondHand) {
    return;
  }

  // We still want to ensure blocking session started is tracked, even if we show current time
  await ensureBlockingSessionStarted();

  const updateTimer = () => {
    const now = new Date();
    
    const seconds = now.getSeconds();
    const secondsDegrees = seconds * 6;
    
    const minutes = now.getMinutes();
    const minutesDegrees = (minutes * 6) + (seconds / 60) * 6;
    
    const hours = now.getHours();
    const hoursDegrees = ((hours % 12) * 30) + (minutes / 60) * 30;

    secondHand.style.transform = `translateX(-50%) rotate(${secondsDegrees}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${minutesDegrees}deg)`;
    hourHand.style.transform = `translateX(-50%) rotate(${hoursDegrees}deg)`;
  };

  updateTimer();
  setInterval(updateTimer, 1000);
}

async function renderWhitelist() {
  const tableBody = document.getElementById('whitelistTableBody');
  const count = document.getElementById('whitelistCount');

  if (!tableBody || !count) {
    return;
  }

  const storage = await getStorage();
  const rows = [
    ...storage.whitelist.videos.map(item => renderRow(item, 'video')),
    ...storage.whitelist.playlists.map(item => renderRow(item, 'playlist')),
  ];

  if (rows.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="3">No whitelisted links yet.</td>
      </tr>
    `;
    count.textContent = '0 links';
    return;
  }

  tableBody.innerHTML = rows.join('');
  count.textContent = `${rows.length} ${rows.length === 1 ? 'link' : 'links'}`;
}

const fromUrl = getQueryParam('from');
const decodedUrl = fromUrl ? decodeURIComponent(fromUrl) : null;
const urlText = document.getElementById('urlText');

if (urlText) {
  urlText.textContent = decodedUrl ? `Blocked: ${decodedUrl}` : '';
}

startBlockTimer().catch((error) => {
  console.error('[FocusedTube Block Page] Could not start timer:', error);
});

renderWhitelist().catch((error) => {
  console.error('[FocusedTube Block Page] Could not render whitelist:', error);
});
