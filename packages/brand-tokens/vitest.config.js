import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Local config so this package's tests run independently of the os root
// vitest projects (which only match tests/unit/**/*.test.ts).
export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    include: ["test/**/*.test.js"],
  },
});
