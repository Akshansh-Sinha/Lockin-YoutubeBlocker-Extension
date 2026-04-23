import { extractVideoIdFromUrl, extractPlaylistIdFromUrl } from '@/interception/classifier';
import { addVideoToWhitelist, addPlaylistToWhitelist } from '@/storage/index';

function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const fromUrl = getQueryParam('from');
const reason = getQueryParam('reason');

const reasonEl = document.getElementById('reason');
const addBtn = document.getElementById('addBtn') as HTMLButtonElement;
const backBtn = document.getElementById('backBtn') as HTMLButtonElement;

if (reason && reasonEl) {
  reasonEl.textContent = `Reason: ${decodeURIComponent(reason)}`;
}

if (fromUrl) {
  const decodedUrl = decodeURIComponent(fromUrl);

  // Check if URL is a video or playlist
  const videoId = extractVideoIdFromUrl(decodedUrl);
  const playlistId = extractPlaylistIdFromUrl(decodedUrl);

  if (videoId || playlistId) {
    addBtn.style.display = 'block';

    addBtn.addEventListener('click', async () => {
      if (videoId) {
        await addVideoToWhitelist(videoId);
        addBtn.textContent = '✓ Added to whitelist';
        addBtn.disabled = true;
      } else if (playlistId) {
        await addPlaylistToWhitelist(playlistId);
        addBtn.textContent = '✓ Added to whitelist';
        addBtn.disabled = true;
      }
    });
  }
}

backBtn.addEventListener('click', () => {
  window.history.back();
});
