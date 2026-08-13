import { copyFileSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function githubPages(): Plugin {
  return {
    name: "github-pages",
    closeBundle() {
      copyFileSync("dist/index.html", "dist/404.html");
      writeFileSync("dist/.nojekyll", "");
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), githubPages()],
  server: { port: 5173 },
});
