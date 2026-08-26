# Current work

Plan: PLAN-002 — delivery/plans/active/PLAN-002-drawing-performance-improvements.md
Task: PLAN-002-TASK-023 — clean-checkout recovery and final verified checkpoint
Status: doing
Started: 2026-08-26 18:47 America/Port_of_Spain
Next action: publish and verify the Task 22 checkpoint, restore it into a disposable worktree, prove clean-checkout install/build/synthetic run, complete the final recovery map and close PLAN-002 without merging or promoting it.

## Progress snapshot

022 complete18:47 (approximately11m): five PDFs for each 10/40/120-sheet package pass. Candidate print HTML is byte-identical to baseline; every page text hash, page size and sheet order matches; pages1/4/last are pixel-identical and visually inspected. PDF median fell 3,696.22→2,129.00ms, 7,192.32→4,161.25ms and 16,277.66→9,781.65ms. The unchanged private-use punctuation/literal-ID extraction caveat is retained. Audit fixture reset is now deterministic. Checkpoint publication pending;023 started18:47. No live promotion.

021 checkpoint `11c91e71fd2ae522c2f4cf6d6732c1a9552fb58e` is publication-reviewed, pushed and exact remote SHA verified. 771 units, lint/types/build and 30/30 production drawing workflows pass. Against the frozen baseline, final median/p95 are selection 46.60/54.80ms, sheet switch 94.75/129.60ms, Properties 34.20/35.40ms, nudge 133.80/147.70ms, save 151.00/173.30ms and connection display 183.87/207.88ms. The integrated test caught history-derived cache retention at 135.30MB after 60 edits; final cache ownership keeps isolated forced-GC heap flat at 21.77/22.46/21.96MB after 10/50/60 edits while preserving the exact 50-entry undo/redo contract. Product fingerprint `528deaa754e93b5da5a1873ef3714c4febef4630821465902a2325b1a1eecb02`. 021 complete18:36 (approximately36m);022 started18:36. No live promotion.

Stage6 CI `33017558582` passed exact `e8b406811a9dffa666a9bb9a10c569ab5d4dfd01`: audit/lint/types/770 units/bootstrap/build/30 production workflows. Tag `drawing-perf-pass-1-stage-6-20260826` is remotely verified and peels to that source. 020 complete 18:00 (approximately 20m); 021 started 18:00. No live promotion.

020 disables automatic sidebar prefetch only inside an active drawing editor and removes save-time drawing-list revalidation. Across 30 forty-sheet saves, unrelated requests fell 226 to 0, response body 212,609 to 150 bytes, and median/p95 254.49/298.87ms to 215.52/245.43ms. Explicit list navigation returned the fresh saved title. Three failed transport-probe iterations are retained: an early response-body race, an invalid `response.finished()` assumption, and an intentionally interrupted confirmation run before CDP byte counting.

019 CI `33016170028` passed exact `3e636cabd1c39f6191b979f5d45c9b3b45e107f6`: audit/lint/types/762 units/bootstrap/build/30 production workflows. 019 complete 17:40 (approximately 13m); 020 started 17:40. Stage6 remains open and untagged. No live promotion.

019 changes normal save from a four-query full-detail reread to a three-query persisted `{id,updatedAt}` acknowledgment. Forty-sheet median/p95 fell 36.06/42.46ms to 21.95/26.11ms and mutation JSON 182,083 to 62 bytes. Conflict, approval-full-detail, and edit-during-in-flight behavior are explicit tests.

Stage5 CI `33015096686` passed exact `b7eb5ca1e527ccdfaa81373d50a87bcac129c9ba`: audit/lint/types/760 units/bootstrap/build/29 production workflows. Tag `drawing-perf-pass-1-stage-5-20260826` is remotely verified and peels to that source. 018 complete 17:27 (approximately 20m); 019 started 17:27. No live promotion.

018 bounds the drawing list to two queries and at most 25 parsed documents. At 500 packages median/p95 fell from 1,352.99/1,879.40ms to 77.37/90.73ms and response bytes from 63,781 to 3,267. Stable ordering, invalid/out-of-range handling, exact counts, last-page deletion, and unchanged BOM access are covered.

Stage4 CI `33013450318` passed exact `25bc359e183329ed07217d946ea127feada3d9c9`: lint/types/750 units/audit/bootstrap/build/28 production workflows. Tag `drawing-perf-pass-1-stage-4-20260826` is remotely verified and peels to that exact tested source. 017 complete 17:07 (approximately 37m); 018 started 17:07. No live promotion.

017 split every drawing consumer from the full symbol catalogue, added atomic recursive exact dependency closure, and kept unused summary browsing outside graph invalidation. At 1,000 entries the whole initial response is 771,551 bytes with no unused SVGs, versus a separately measured 2,850,875-byte legacy full-catalogue query. 28/28 local and GitHub production workflows pass; first-load and retained negative evidence remain explicit.

016 checkpoint `5899503f4953c7ea9b8cd63fb5399c36a333279c` publication-reviewed, pushed and exact remote branch SHA verified. 017 started 16:30. Stage 4 remains open; no live promotion.

016 complete 16:30 (approximately 7m): editor-scoped exact-version loader deduplicates concurrent requests, caches immutable successes, leaves errors retryable and prevents partial insertion. Six loader contracts, 746 units, lint/types/build and three production workflows pass. Actual drawing-consumer migration remains deliberately in 017.

015 checkpointc8948aaef061cf651bfa82e46743a8e33141d554 publication-reviewed, pushed and exact remote branch SHA verified.016 started16:23. Stage4 remains open; no live promotion.

015 complete16:22 (approx11m): exact bundle stays2,829bytes/~1ms from25to1,000unused symbols versus legacy2.85MB/111.55ms at1,000; summary355,398bytes/94.76ms. Test-first query contracts,740units, lint/types/build and4production workflows pass.

014 checkpoint2cd5d670a36b1d9a382c97e96cdb2e7ff00b2f78 publication-reviewed, pushed and exact remote branch SHA verified.015 started16:11. Stage4 remains open; no live promotion.

014 complete16:10 (approx10m): predecessor missed managed-asset and placement/asset module-template references and forwarded11generated pseudo IDs. Candidate returns all10 persisted fixture dependencies only, retains exact missing history with no latest fallback.735units, lint/types/build and6production workflows pass.

Stage3 CI33007739398 passed exacta4c2d8ced508b22bc69a7b212ffd6271d1b52138: audit/lint/types/733units/harness/bootstrap/build/28production workflows. Tag drawing-perf-pass-1-stage-3-20260826 remote verified, peeled exact.014 started16:00. No live promotion.

013 complete15:55 (approx18m): exact lookup26.79/36.90ms to final2.17/2.97; generated resolution60.73/81.87ms to final0.10/0.15, identical checksums. Weak-key indexes preserve first-match, delimiter-safe exact identity, placement/asset/symbol invalidation and occurrence isolation.733units, types/lint/build,7targeted and28/28full production workflows pass; final hardening build and3workflow rerun also pass. Stage3 checkpoint/CI/tag pending.

012 checkpointd42fe9cbbdbcb7a1bec4ffb7c3bf5e087ed4b94e publication-reviewed, pushed and exact remote branch SHA verified.013 started15:37. Stage3 remains open; no live promotion.

012 complete15:36 (approx16m): editor-scoped preparation returns one final model/source pair, rebuilds from the final model only when wire-ID reconciliation mutates it, and survives unchanged Server Action prop serialization. Selection/sheet/preview/save record0normalize/source/graph rebuilds; a real mutation records1source/graph/history and0requests.729units, types/lint/build and5production workflows pass. Two diagnostic red runs and one no-server invocation error are retained.

011 checkpoint875686a154444404e176b0e3a4029f4d8d0f07f7 publication-reviewed, pushed and exact remote branch SHA verified.012 started15:20. Stage3 remains open; no live promotion.

011 complete15:19 (approx6m):12,281real/adversarial identifiers and961pairwise cases prove equivalent reusable numeric ordering. ABBA sorting falls~998ms to~36ms. Source120 electrical network now30.52/35.10ms and repeats31.64/36.94ms, below100ms p95; combined validation+graph p95108.27 remains visible.726units, types/lint/build and4production workflows pass. Checkpoint publication pending.

010 checkpointebca8db7484270f12888cca41f184d708736e19c publication-reviewed, pushed and exact remote branch SHA verified.011 started15:13. Stage3 remains open; no live promotion.

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
