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

  let secondsRotationBase = 0;
  let minutesRotationBase = 0;
  let hoursRotationBase = 0;
  let initialized = false;

  const updateTimer = () => {
    const now = new Date();
    
    // Normal single-circle degrees
    const currentSecondsDegrees = now.getSeconds() * 6;
    const currentMinutesDegrees = now.getMinutes() * 6 + (now.getSeconds() / 60) * 6;
    const currentHoursDegrees = ((now.getHours() % 12) * 30) + (now.getMinutes() / 60) * 30;

    if (!initialized) {
      secondsRotationBase = currentSecondsDegrees;
      minutesRotationBase = currentMinutesDegrees;
      hoursRotationBase = currentHoursDegrees;
      initialized = true;
    }

    // Determine current base rotation by rounding down existing base
    const secBase = Math.floor(secondsRotationBase / 360) * 360;
    const minBase = Math.floor(minutesRotationBase / 360) * 360;
    const hrBase = Math.floor(hoursRotationBase / 360) * 360;

    let targetSecondsDegrees = secBase + currentSecondsDegrees;
    let targetMinutesDegrees = minBase + currentMinutesDegrees;
    let targetHoursDegrees = hrBase + currentHoursDegrees;

    // Avoid backwards wrap-around
    if (targetSecondsDegrees < secondsRotationBase - 180) targetSecondsDegrees += 360;
    if (targetMinutesDegrees < minutesRotationBase - 180) targetMinutesDegrees += 360;
    if (targetHoursDegrees < hoursRotationBase - 180) targetHoursDegrees += 360;

    secondsRotationBase = targetSecondsDegrees;
    minutesRotationBase = targetMinutesDegrees;
    hoursRotationBase = targetHoursDegrees;

    secondHand.style.transform = `translateX(-50%) rotate(${secondsRotationBase}deg)`;
    minuteHand.style.transform = `translateX(-50%) rotate(${minutesRotationBase}deg)`;
    hourHand.style.transform = `translateX(-50%) rotate(${hoursRotationBase}deg)`;
  };

  updateTimer();
  
  // Wait a moment for initial styles to paint, then enable transitions
  setTimeout(() => {
    analogTimer.classList.add('ticking');
  }, 50);

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
const sourceParam = getQueryParam('source');
const signalsParam = getQueryParam('signals');

if (urlText) {
  urlText.textContent = decodedUrl ? `Blocked: ${decodedUrl}` : '';
}

const reasonParam = getQueryParam('reason');
const blockReason = document.getElementById('blockReason');
if (blockReason && reasonParam) {
  blockReason.textContent = `Reason: ${decodeURIComponent(reasonParam)}`;
}

// Log Provenance trace to developer console instead of showing to the user
if (sourceParam) {
  console.group('%c[Lockin] Decision Trace', 'color: #d8d0bd; font-weight: bold;');
  console.log(`Source: %c${sourceParam.toUpperCase()}`, 'color: #e74c3c; font-weight: bold;');
  
  if (signalsParam) {
    try {
      const signals = JSON.parse(decodeURIComponent(signalsParam));
      if (Array.isArray(signals) && signals.length > 0) {
        signals.forEach(sig => console.log(`• ${sig}`));
      } else {
        console.log('No specific signals provided.');
      }
    } catch (e) {
      console.log(`• Raw signals: ${signalsParam}`);
    }
  } else {
    const reasonParam = getQueryParam('reason');
    console.log(`• Reason: ${reasonParam || 'Default deny'}`);
  }
  console.groupEnd();
}

startBlockTimer().catch((error) => {
  console.error('[Lockin Block Page] Could not start timer:', error);
});

renderWhitelist().catch((error) => {
  console.error('[Lockin Block Page] Could not render whitelist:', error);
});
