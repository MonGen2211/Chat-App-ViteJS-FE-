import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000, // ép vite chạy cổng 3000
    host: true, // quan trọng: để container có thể truy cập qua 0.0.0.0
  },
});
