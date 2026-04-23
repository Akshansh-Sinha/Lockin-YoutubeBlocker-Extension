import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Lockin',
  version: '1.0.0',
  description: 'Stay completely focused and locked in by turning YouTube into a highly intentional learning tool.',
  permissions: [
    'storage',
    'webNavigation',
    'scripting',
    'identity',
    'tabs',
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
    "128": "logo.png"
  },
  content_scripts: [
    {
      matches: [
        // Filtered mode needs the content script on home, search, channel pages, etc.
        // Strict mode does a mode-check and only activates History API interception.
        '*://youtube.com/*',
        '*://www.youtube.com/*',
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
