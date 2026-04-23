console.log('[FocusedTube Block Page] Initializing');

function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function extractVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString, 'https://youtube.com');
    if (url.searchParams.has('v')) {
      return url.searchParams.get('v');
    }
    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0];
    }
  } catch (error) {
    console.error('[FocusedTube] Error extracting video ID:', error);
  }
  return null;
}

function extractPlaylistId(urlString: string): string | null {
  try {
    const url = new URL(urlString, 'https://youtube.com');
    if (url.searchParams.has('list')) {
      return url.searchParams.get('list');
    }
  } catch (error) {
    console.error('[FocusedTube] Error extracting playlist ID:', error);
  }
  return null;
}

const fromUrl = getQueryParam('from');
const reason = getQueryParam('reason');
const decodedUrl = fromUrl ? decodeURIComponent(fromUrl) : null;

let videoId: string | null = null;
let playlistId: string | null = null;

if (decodedUrl) {
  videoId = extractVideoId(decodedUrl);
  playlistId = extractPlaylistId(decodedUrl);
}

const reasonText = document.getElementById('reasonText');
const urlText = document.getElementById('urlText');
const debugInfo = document.getElementById('debugInfo');
const backBtn = document.getElementById('backBtn');
const addBtn = document.getElementById('addBtn') as HTMLButtonElement | null;
const addBtnText = document.getElementById('addBtnText');

if (reasonText) {
  reasonText.textContent = reason ? decodeURIComponent(reason) : 'Not whitelisted';
}

if (urlText) {
  urlText.textContent = decodedUrl || 'Unknown';
}

if (debugInfo) {
  debugInfo.textContent = JSON.stringify({
    url: decodedUrl,
    reason: reason ? decodeURIComponent(reason) : null,
    videoId,
    playlistId,
    timestamp: new Date().toISOString(),
  }, null, 2);
}

backBtn?.addEventListener('click', () => {
  console.log('[FocusedTube Block Page] Going back');
  window.history.back();
});

if ((videoId || playlistId) && addBtn && addBtnText) {
  addBtnText.textContent = videoId ? 'Add Video' : 'Add Playlist';
  addBtn.style.display = 'flex';

  addBtn.addEventListener('click', async () => {
    console.log('[FocusedTube Block Page] Adding to whitelist:', { videoId, playlistId });

    try {
      addBtn.disabled = true;

      const messageData = videoId
        ? { type: 'ADD_VIDEO', videoId }
        : { type: 'ADD_PLAYLIST', playlistId };

      await chrome.runtime.sendMessage(messageData);

      console.log('[FocusedTube Block Page] Successfully added to whitelist');

      const successBanner = document.getElementById('successBanner');
      const successText = document.getElementById('successText');
      if (successText) {
        successText.textContent = videoId ? 'Video added to whitelist!' : 'Playlist added to whitelist!';
      }
      successBanner?.classList.add('show');

      addBtn.style.display = 'none';
    } catch (error) {
      console.error('[FocusedTube Block Page] Error:', error);
      addBtn.disabled = false;
    }
  });
}

console.log('[FocusedTube Block Page] Ready');
