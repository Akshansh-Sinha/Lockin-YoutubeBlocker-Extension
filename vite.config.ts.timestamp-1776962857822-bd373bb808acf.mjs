// vite.config.ts
import { defineConfig } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/vite/dist/node/index.js";
import { crx } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// src/manifest.ts
import { defineManifest } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/@crxjs/vite-plugin/dist/index.mjs";
var manifest_default = defineManifest({
  manifest_version: 3,
  name: "Lockin",
  version: "1.0.0",
  description: "Stay completely focused and locked in by turning YouTube into a highly intentional learning tool.",
  permissions: [
    "storage",
    "webNavigation",
    "scripting"
  ],
  host_permissions: [
    "*://youtube.com/*",
    "*://www.youtube.com/*"
  ],
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  action: {
    default_popup: "src/ui/popup/index.html",
    default_title: "Lockin",
    default_icon: "logo.png"
  },
  icons: {
    "128": "logo.png"
  },
  content_scripts: [
    {
      matches: [
        "*://youtube.com/watch*",
        "*://www.youtube.com/watch*",
        "*://youtube.com/playlist*",
        "*://www.youtube.com/playlist*"
      ],
      js: ["src/ui/content/content.ts"],
      run_at: "document_start"
    }
  ],
  web_accessible_resources: [
    {
      resources: ["src/ui/block/index.html"],
      matches: ["*://youtube.com/*", "*://www.youtube.com/*"]
    }
  ]
});

// vite.config.ts
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Akshansh Sinha\\YoutubeBlocker";
var vite_config_default = defineConfig({
  plugins: [crx({ manifest: manifest_default })],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        block: path.resolve(__vite_injected_original_dirname, "src/ui/block/index.html")
      },
      output: {
        manualChunks: void 0
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWtzaGFuc2ggU2luaGFcXFxcWW91dHViZUJsb2NrZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFrc2hhbnNoIFNpbmhhXFxcXFlvdXR1YmVCbG9ja2VyXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Ba3NoYW5zaCUyMFNpbmhhL1lvdXR1YmVCbG9ja2VyL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LnRzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbY3J4KHsgbWFuaWZlc3QgfSldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBibG9jazogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy91aS9ibG9jay9pbmRleC5odG1sJyksXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFrc2hhbnNoIFNpbmhhXFxcXFlvdXR1YmVCbG9ja2VyXFxcXHNyY1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWtzaGFuc2ggU2luaGFcXFxcWW91dHViZUJsb2NrZXJcXFxcc3JjXFxcXG1hbmlmZXN0LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Ba3NoYW5zaCUyMFNpbmhhL1lvdXR1YmVCbG9ja2VyL3NyYy9tYW5pZmVzdC50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxuICBuYW1lOiAnTG9ja2luJyxcbiAgdmVyc2lvbjogJzEuMC4wJyxcbiAgZGVzY3JpcHRpb246ICdTdGF5IGNvbXBsZXRlbHkgZm9jdXNlZCBhbmQgbG9ja2VkIGluIGJ5IHR1cm5pbmcgWW91VHViZSBpbnRvIGEgaGlnaGx5IGludGVudGlvbmFsIGxlYXJuaW5nIHRvb2wuJyxcbiAgcGVybWlzc2lvbnM6IFtcbiAgICAnc3RvcmFnZScsXG4gICAgJ3dlYk5hdmlnYXRpb24nLFxuICAgICdzY3JpcHRpbmcnLFxuICBdLFxuICBob3N0X3Blcm1pc3Npb25zOiBbXG4gICAgJyo6Ly95b3V0dWJlLmNvbS8qJyxcbiAgICAnKjovL3d3dy55b3V0dWJlLmNvbS8qJyxcbiAgXSxcbiAgYmFja2dyb3VuZDoge1xuICAgIHNlcnZpY2Vfd29ya2VyOiAnc3JjL2JhY2tncm91bmQudHMnLFxuICAgIHR5cGU6ICdtb2R1bGUnLFxuICB9LFxuICBhY3Rpb246IHtcbiAgICBkZWZhdWx0X3BvcHVwOiAnc3JjL3VpL3BvcHVwL2luZGV4Lmh0bWwnLFxuICAgIGRlZmF1bHRfdGl0bGU6ICdMb2NraW4nLFxuICAgIGRlZmF1bHRfaWNvbjogJ2xvZ28ucG5nJ1xuICB9LFxuICBpY29uczoge1xuICAgIFwiMTI4XCI6IFwibG9nby5wbmdcIlxuICB9LFxuICBjb250ZW50X3NjcmlwdHM6IFtcbiAgICB7XG4gICAgICBtYXRjaGVzOiBbXG4gICAgICAgICcqOi8veW91dHViZS5jb20vd2F0Y2gqJyxcbiAgICAgICAgJyo6Ly93d3cueW91dHViZS5jb20vd2F0Y2gqJyxcbiAgICAgICAgJyo6Ly95b3V0dWJlLmNvbS9wbGF5bGlzdConLFxuICAgICAgICAnKjovL3d3dy55b3V0dWJlLmNvbS9wbGF5bGlzdConLFxuICAgICAgXSxcbiAgICAgIGpzOiBbJ3NyYy91aS9jb250ZW50L2NvbnRlbnQudHMnXSxcbiAgICAgIHJ1bl9hdDogJ2RvY3VtZW50X3N0YXJ0JyxcbiAgICB9LFxuICBdLFxuICB3ZWJfYWNjZXNzaWJsZV9yZXNvdXJjZXM6IFtcbiAgICB7XG4gICAgICByZXNvdXJjZXM6IFsnc3JjL3VpL2Jsb2NrL2luZGV4Lmh0bWwnXSxcbiAgICAgIG1hdGNoZXM6IFsnKjovL3lvdXR1YmUuY29tLyonLCAnKjovL3d3dy55b3V0dWJlLmNvbS8qJ10sXG4gICAgfSxcbiAgXSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4UyxTQUFTLG9CQUFvQjtBQUMzVSxTQUFTLFdBQVc7OztBQ0RrUyxTQUFTLHNCQUFzQjtBQUVyVixJQUFPLG1CQUFRLGVBQWU7QUFBQSxFQUM1QixrQkFBa0I7QUFBQSxFQUNsQixNQUFNO0FBQUEsRUFDTixTQUFTO0FBQUEsRUFDVCxhQUFhO0FBQUEsRUFDYixhQUFhO0FBQUEsSUFDWDtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0Esa0JBQWtCO0FBQUEsSUFDaEI7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUFBLEVBQ0EsWUFBWTtBQUFBLElBQ1YsZ0JBQWdCO0FBQUEsSUFDaEIsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLGVBQWU7QUFBQSxJQUNmLGVBQWU7QUFBQSxJQUNmLGNBQWM7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsT0FBTztBQUFBLEVBQ1Q7QUFBQSxFQUNBLGlCQUFpQjtBQUFBLElBQ2Y7QUFBQSxNQUNFLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLE1BQ0EsSUFBSSxDQUFDLDJCQUEyQjtBQUFBLE1BQ2hDLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUFBLEVBQ0EsMEJBQTBCO0FBQUEsSUFDeEI7QUFBQSxNQUNFLFdBQVcsQ0FBQyx5QkFBeUI7QUFBQSxNQUNyQyxTQUFTLENBQUMscUJBQXFCLHVCQUF1QjtBQUFBLElBQ3hEO0FBQUEsRUFDRjtBQUNGLENBQUM7OztBRDNDRCxPQUFPLFVBQVU7QUFIakIsSUFBTSxtQ0FBbUM7QUFLekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLElBQUksRUFBRSwyQkFBUyxDQUFDLENBQUM7QUFBQSxFQUMzQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixPQUFPO0FBQUEsUUFDTCxPQUFPLEtBQUssUUFBUSxrQ0FBVyx5QkFBeUI7QUFBQSxNQUMxRDtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLE1BQ2hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
