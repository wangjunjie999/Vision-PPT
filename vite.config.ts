import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { normalizeStorageProxyUploadMode, storageProxyPlugin } from "./vite-plugins/storageProxy";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || "";
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  const storageProxyUploadMode = normalizeStorageProxyUploadMode(env.STORAGE_PROXY_UPLOAD_MODE);
  const isDev = mode === "development";
  return {
  server: {
    host: "::",
    port: 8080,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
  plugins: [
    react(),
    isDev && componentTagger(),
    isDev && supabaseUrl ? storageProxyPlugin({ supabaseUrl, publishableKey: supabasePublishableKey, uploadMode: storageProxyUploadMode }) : null,
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'report-vendor': ['pptxgenjs', 'jspdf', 'docx', 'xlsx'],
          'chart-vendor': ['recharts'],
        },
      },
    },
  },
  };
});
