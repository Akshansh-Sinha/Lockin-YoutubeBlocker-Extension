import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Lockin',
  version: '1.0.0',
  description: 'Turn YouTube into a controlled learning tool',
  permissions: [
    'storage',
    'webNavigation',
    'scripting',
  ],
  host_permissions: [
    '*://youtube.com/*',
    '*://www.youtube.com/*',
  ],
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/ui/popup/index.html',
    default_title: 'Lockin',
    default_icon: 'logo.png'
  },
  icons: {
    "16": "logo.png",
    "48": "logo.png",
    "128": "logo.png"
  },
  content_scripts: [
    {
      matches: [
        '*://youtube.com/watch*',
        '*://www.youtube.com/watch*',
        '*://youtube.com/playlist*',
        '*://www.youtube.com/playlist*',
      ],
      js: ['src/ui/content/content.ts'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/ui/block/index.html'],
      matches: ['*://youtube.com/*', '*://www.youtube.com/*'],
    },
  ],
});
