import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Config minimale: solo lib/**/*.test.ts sono funzioni pure, nessun
// bisogno di ambiente DOM. L'alias "@/*" replica tsconfig.json, per
// eventuali test futuri che importano da "@/lib/...".
export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
