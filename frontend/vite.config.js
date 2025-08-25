import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  return {
    plugins: [react()],
    server: {
      fs: {
        // Allow importing generated declarations from the project root
        allow: [path.resolve(__dirname, "..")],
      },
    },
    define: {
      // Optional: surface dfx-written canister IDs to the app if present
      "import.meta.env.VITE_AUTHENTICATION_CANISTER_ID": JSON.stringify(
        env.CANISTER_ID_AUTHENTICATION || ""
      ),
      "import.meta.env.VITE_INTERNET_IDENTITY_CANISTER_ID": JSON.stringify(
        env.CANISTER_ID_INTERNET_IDENTITY || ""
      ),
      "import.meta.env.VITE_TABLE_MANAGEMENT_CANISTER_ID": JSON.stringify(
        env.CANISTER_ID_TABLE_MANAGEMENT || ""
      ),
      // Polyfills for Internet Computer SDK
      global: "globalThis",
    },
  };
});
