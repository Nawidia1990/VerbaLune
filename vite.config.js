import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large, rarely-changing dependencies into their own chunk so
        // browsers can cache them separately from app code that changes often.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});
