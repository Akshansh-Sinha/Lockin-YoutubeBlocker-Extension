// vite.config.ts
import { defineConfig } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/vite/dist/node/index.js";
import { crx } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// src/manifest.ts
import { defineManifest } from "file:///C:/Users/Akshansh%20Sinha/YoutubeBlocker/node_modules/@crxjs/vite-plugin/dist/index.mjs";
var manifest_default = defineManifest({
  manifest_version: 3,
  name: "Lockin",
  version: "1.0.0",
  description: "Turn YouTube into a controlled learning tool",
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
    default_icon: "public/logo.jpg"
  },
  icons: {
    "16": "public/logo.jpg",
    "48": "public/logo.jpg",
    "128": "public/logo.jpg"
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWtzaGFuc2ggU2luaGFcXFxcWW91dHViZUJsb2NrZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFrc2hhbnNoIFNpbmhhXFxcXFlvdXR1YmVCbG9ja2VyXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Ba3NoYW5zaCUyMFNpbmhhL1lvdXR1YmVCbG9ja2VyL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBjcnggfSBmcm9tICdAY3J4anMvdml0ZS1wbHVnaW4nO1xuaW1wb3J0IG1hbmlmZXN0IGZyb20gJy4vc3JjL21hbmlmZXN0LnRzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbY3J4KHsgbWFuaWZlc3QgfSldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBibG9jazogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy91aS9ibG9jay9pbmRleC5odG1sJyksXG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczogdW5kZWZpbmVkLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXEFrc2hhbnNoIFNpbmhhXFxcXFlvdXR1YmVCbG9ja2VyXFxcXHNyY1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQWtzaGFuc2ggU2luaGFcXFxcWW91dHViZUJsb2NrZXJcXFxcc3JjXFxcXG1hbmlmZXN0LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Ba3NoYW5zaCUyMFNpbmhhL1lvdXR1YmVCbG9ja2VyL3NyYy9tYW5pZmVzdC50c1wiO2ltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBtYW5pZmVzdF92ZXJzaW9uOiAzLFxuICBuYW1lOiAnTG9ja2luJyxcbiAgdmVyc2lvbjogJzEuMC4wJyxcbiAgZGVzY3JpcHRpb246ICdUdXJuIFlvdVR1YmUgaW50byBhIGNvbnRyb2xsZWQgbGVhcm5pbmcgdG9vbCcsXG4gIHBlcm1pc3Npb25zOiBbXG4gICAgJ3N0b3JhZ2UnLFxuICAgICd3ZWJOYXZpZ2F0aW9uJyxcbiAgICAnc2NyaXB0aW5nJyxcbiAgXSxcbiAgaG9zdF9wZXJtaXNzaW9uczogW1xuICAgICcqOi8veW91dHViZS5jb20vKicsXG4gICAgJyo6Ly93d3cueW91dHViZS5jb20vKicsXG4gIF0sXG4gIGJhY2tncm91bmQ6IHtcbiAgICBzZXJ2aWNlX3dvcmtlcjogJ3NyYy9iYWNrZ3JvdW5kLnRzJyxcbiAgICB0eXBlOiAnbW9kdWxlJyxcbiAgfSxcbiAgYWN0aW9uOiB7XG4gICAgZGVmYXVsdF9wb3B1cDogJ3NyYy91aS9wb3B1cC9pbmRleC5odG1sJyxcbiAgICBkZWZhdWx0X3RpdGxlOiAnTG9ja2luJyxcbiAgICBkZWZhdWx0X2ljb246ICdwdWJsaWMvbG9nby5qcGcnXG4gIH0sXG4gIGljb25zOiB7XG4gICAgXCIxNlwiOiBcInB1YmxpYy9sb2dvLmpwZ1wiLFxuICAgIFwiNDhcIjogXCJwdWJsaWMvbG9nby5qcGdcIixcbiAgICBcIjEyOFwiOiBcInB1YmxpYy9sb2dvLmpwZ1wiXG4gIH0sXG4gIGNvbnRlbnRfc2NyaXB0czogW1xuICAgIHtcbiAgICAgIG1hdGNoZXM6IFtcbiAgICAgICAgJyo6Ly95b3V0dWJlLmNvbS93YXRjaConLFxuICAgICAgICAnKjovL3d3dy55b3V0dWJlLmNvbS93YXRjaConLFxuICAgICAgICAnKjovL3lvdXR1YmUuY29tL3BsYXlsaXN0KicsXG4gICAgICAgICcqOi8vd3d3LnlvdXR1YmUuY29tL3BsYXlsaXN0KicsXG4gICAgICBdLFxuICAgICAganM6IFsnc3JjL3VpL2NvbnRlbnQvY29udGVudC50cyddLFxuICAgICAgcnVuX2F0OiAnZG9jdW1lbnRfc3RhcnQnLFxuICAgIH0sXG4gIF0sXG4gIHdlYl9hY2Nlc3NpYmxlX3Jlc291cmNlczogW1xuICAgIHtcbiAgICAgIHJlc291cmNlczogWydzcmMvdWkvYmxvY2svaW5kZXguaHRtbCddLFxuICAgICAgbWF0Y2hlczogWycqOi8veW91dHViZS5jb20vKicsICcqOi8vd3d3LnlvdXR1YmUuY29tLyonXSxcbiAgICB9LFxuICBdLFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThTLFNBQVMsb0JBQW9CO0FBQzNVLFNBQVMsV0FBVzs7O0FDRGtTLFNBQVMsc0JBQXNCO0FBRXJWLElBQU8sbUJBQVEsZUFBZTtBQUFBLEVBQzVCLGtCQUFrQjtBQUFBLEVBQ2xCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxFQUNULGFBQWE7QUFBQSxFQUNiLGFBQWE7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxrQkFBa0I7QUFBQSxJQUNoQjtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sZUFBZTtBQUFBLElBQ2YsZUFBZTtBQUFBLElBQ2YsY0FBYztBQUFBLEVBQ2hCO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsaUJBQWlCO0FBQUEsSUFDZjtBQUFBLE1BQ0UsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxJQUFJLENBQUMsMkJBQTJCO0FBQUEsTUFDaEMsUUFBUTtBQUFBLElBQ1Y7QUFBQSxFQUNGO0FBQUEsRUFDQSwwQkFBMEI7QUFBQSxJQUN4QjtBQUFBLE1BQ0UsV0FBVyxDQUFDLHlCQUF5QjtBQUFBLE1BQ3JDLFNBQVMsQ0FBQyxxQkFBcUIsdUJBQXVCO0FBQUEsSUFDeEQ7QUFBQSxFQUNGO0FBQ0YsQ0FBQzs7O0FEN0NELE9BQU8sVUFBVTtBQUhqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsSUFBSSxFQUFFLDJCQUFTLENBQUMsQ0FBQztBQUFBLEVBQzNCLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE9BQU8sS0FBSyxRQUFRLGtDQUFXLHlCQUF5QjtBQUFBLE1BQzFEO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
