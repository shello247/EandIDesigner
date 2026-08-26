# Current work

Plan: PLAN-002 — delivery/plans/active/PLAN-002-drawing-performance-improvements.md
Task: PLAN-002-TASK-010 — index endpoint and topology resolution
Status: complete; checkpoint publication in progress
Started: 2026-08-26 12:55 America/Port_of_Spain
Next action: review and publish the Task010 checkpoint, verify its exact remote SHA, then start Task011 numeric-ordering equivalence benchmark.

## Progress snapshot

010 complete15:12 (approx14m): first-resolved external endpoint index and direct canonical topology-terminal lookup preserve adversarial semantics. ABBA endpoint lookup drops57.30/54.07ms medians to4.42/4.31ms with identical checksum; complete-stage p95 remains noisy and above100ms.724units, types/lint/build and4production workflows pass. Speculative eager anchor index was measured then removed. Checkpoint publication pending.

009 checkpoint5dfadf66d244978c9751712cc2d17ce5aeaadb08 publication-reviewed, pushed and exact remote branch SHA verified.010 started14:58. Stage3 remains open; no live promotion.

Stage2 CI33001312593 passed all gates and28production workflows. Tag drawing-perf-pass-1-stage-2-20260826 remote verified, peeled ab2dd18969bb4d9f4a18b8561607892cb3d4fec7.009 started14:48.

009 complete14:56 (approx8m): editor-scoped weak snapshot cache eliminates unchanged source/graph rebuilds for selection, sheet and preview transitions. Mutation still records1history/source/graph build and0requests.720units, types/lint/build, focused production diagnostic and3affected workflows pass. Failed audit-selector attempts retained; checkpoint publication pending.

008 local completion14:43 (approx11m): bounded diagnostics are off with zero allocation by default; action/revision-correlated stages separate from settled time. Final parity,90gesture invariants, Wire Catalog Linux sync,719units/types/lint/build pass. Prior CI/audit failures retained. Stage2 tag awaits clean checkpoint CI.

007 checkpoint7d1c97a6945508733a6f4808af05a3778b5a6cde publication-reviewed, pushed and exact remote branch SHA verified.008 started14:32. Stage2 remains open; no live promotion.

007 complete14:32 (approx9m): held-chunk regression proves no unopened request/overlay and first-open lazy load. Draft, handled error/retry, close/reopen/focus/Escape pass; nested Escape regression fixed.8focused tests/types/lint/build and2production workflows pass. Prior red/diagnostic failures retained; no timing gain claimed.

Stage1 tag remote verified (peeled c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83); documentation07387b294f9e897571bb4d86d4731691471525fd pushed/verified.007 started14:23. No live promotion or main merge.

006 completed14:23 (approx23m). CI32998854844 passed at18:21:04Z for exact c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83: audit/lint/types/714units/harness/bootstrap/build/27production workflows. No retries/page errors. Stage1 tag targets this tested code SHA, not a later documentation commit. Prior failure evidence retained.

Native-path fixture repair c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83 remotely verified.4focused tests/lint pass; secondCI32998854844 in progress. First failure artifacts downloaded into guarded local evidence path. No runtime changes.

CI32998543073 failed:713units pass,1Windows-path fixture assumption fails on Linux. Fix only native fixture/expected path; production resolver untouched. Install/audit/Chromium/lint/types pass. First failure evidence retained; no Stage1 tag.

006 code checkpointe6b4f77673dcd47697c4ad8509626f693c1d5ac2 pushed/remote verified. CI32998543073 is running; install/audit pass. Stage1 remains unverified until the full clean-checkout result.

006 local verification:714units/118files,16harness tests,8CI contracts, production build and27/27browser workflows pass. The stronger shared page/popup error guard also passes27/27 and rejects an intentional negative probe. Final types/lint pass after renaming the fixture callback (no rule suppression). GitHub clean-checkout gate remains required. Original source/live3000 unchanged; no3100 listener.

005 checkpointb29ee8fc592efe09b8a61721a0858ecc42b21b37 remotely verified;006 started14:00. CI adds audited24files/27workflows with explicit remaining coverage register.

005 complete13:59: four production workflows pass with all engineering assertions retained. Focused lint/full types pass. No application change. Full Stage1 gate next under006.

004 checkpoint59bdde1ed9bcdc635149e116e9b13ad0fe933695 remotely verified.005 started13:57. Last verified-stage tag remains Stage0.

004 complete13:56: one panel SVG title expression fixes demonstrated empty SSR title.2regression cases fail-before/pass-after;16harness tests, full types/lint/build and unchanged production assignment browser pass. No page errors. Original source verified unchanged. Stage1 not yet complete.

Stage0 tag remotely verified13:48: drawing-perf-pass-1-stage-0-20260826 peels to72888c4c554b92862a7ea31f93c606069b47fb0c. Task004 started; diagnostic development runs separated from production acceptance.

Stage0 complete13:47: originala833827 clean recovery install/bootstrap/build and create/save/reload browser pass; pristine Git status retained. Harness14 tests, scoped lint, full types pass. Recovery/candidate servers stopped; only live3000 PID31720 remains. Original source matches at17:46:43Z. Tag: drawing-perf-pass-1-stage-0-20260826 (publish/verify before continuing). Known browser22pass/5fail is not a release pass.

Task002A complete13:41: audit0,types0,704units/lint/build pass; browser22pass/5fail exact same failing set as baseline. No new detected regression; no greenStage1 claim. Owned3100 stopped; original source hashes still match. Security code99f38c5 and type repair9349e31 remotely verified. See002A report for evidence and retained risks.

Task003 complete13:36: standalone typecheck0 errors,704 units/116files, full lint and production build pass. No runtime logic or weakened assertions; metadata fixtures corrected and discriminants narrowed. No stage tag; browser/hydration gate remains.

Security WIP99f38c530e0fad2c4349b914c245aca664e3ec6b pushed and exact remote SHA verified. Task003 started13:33 local. No verified-stage tag yet.

Task001 complete. Recovery a8338272ea99e79f1909a6e8edd3cf8fa95bd01e pushed and exact remote SHA verified. All 655 audited product source hashes match; original reliability-hardening and live port3000 PID31720 untouched. No product optimization yet.

Task002: harness10 tests/scoped lint/types and isolated installs pass. Task002A resolves all13 audit package findings, with no exceptions;704 unit tests and full lint pass. Candidate Next16.3.3 build now includes39 known test-type diagnostics (exactly the original standalone set). Removed redundant deprecated baseUrl; no suppression. Bring forward Task003 before finishing002A build/browser checks. Synthetic bootstrap passes; original source hashes still match; port3000 PID31720 untouched, no3100 server yet. No verified-stage tag.
