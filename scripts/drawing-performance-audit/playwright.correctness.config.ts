import {defineConfig,devices} from "@playwright/test";
import path from "node:path";
const phase=process.env.AUDIT_CORRECTNESS_PHASE??"adapted";
export default defineConfig({testDir:"../../tests/e2e",testMatch:["drawing-panel-connection-patterns.spec.ts","drawing-panel-terminal-mapping.spec.ts","drawing-terminal-block-group.spec.ts","drawing-terminal-strip-destination-copy.spec.ts","drawing-panel-assignment.spec.ts"],workers:1,retries:0,fullyParallel:false,reporter:[["line"],["json",{outputFile:"artifacts/drawing-performance/20260826-baseline/e2e-"+phase+".json"}]],outputDir:path.resolve("artifacts/drawing-performance/20260826-baseline/e2e-"+phase+"-traces"),use:{...devices["Desktop Chrome"],baseURL:"http://127.0.0.1:3100",trace:"retain-on-failure"}});
