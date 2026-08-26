import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";
export default defineConfig({resolve:{alias:{"@":fileURLToPath(new URL("../../src",import.meta.url))}},test:{environment:"node",include:["scripts/drawing-performance-audit/audit.test.ts","scripts/drawing-performance-audit/runner.test.ts"],passWithNoTests:false}});
