import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["regression/**/*.test.ts"], testTimeout: 140_000, fileParallelism: false, sequence: { concurrent: false } } });
