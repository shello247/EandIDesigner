# PLAN-002-TASK-013 — Exact-version and generated render preparation

Start: 2026-08-26 15:37 America/Port_of_Spain
End: 2026-08-26 15:55 America/Port_of_Spain
Duration: approximately 18 minutes
Status: complete; checkpoint publication and Stage3 CI pending

## Invariants

Any retained lookup or generated-geometry cache must have complete render dependency identity, preserve occurrence-specific labels, anchors and transforms, remain scoped and reclaimable, and produce byte/structure-equivalent output. No drawing format, pinned-version fallback, terminal/wire identity or rendering contract may change.

Predecessor: `d42fe9cbbdbcb7a1bec4ffb7c3bf5e087ed4b94e`, remotely verified.

## Measured baseline and decision

The guarded benchmark resolves 5,000 placements against a 1,000-version approved bundle, then resolves 100 occurrence-specific 20-terminal generated blocks ten times per sample. It uses five warmups, thirty observations and stable output checksums.

| Workload | Predecessor median / p95 | Candidate v1 median / p95 | Candidate repeat median / p95 | Hardened final median / p95 | Checksum |
|---|---:|---:|---:|---:|---:|
| Exact-version resolution | 26.79 / 36.90 ms | 3.26 / 4.21 ms | 3.07 / 3.95 ms | 2.17 / 2.97 ms | 49,450 |
| 1,000 generated-geometry resolutions | 60.73 / 81.87 ms | 0.15 / 0.23 ms | 0.13 / 0.18 ms | 0.10 / 0.15 ms | 27,804,000 |

The final exact lookup improves approximately 92% by median. Repeated generated resolution improves more than 99% because unchanged occurrence geometry is no longer regenerated. The independent candidate repeat and final rerun confirm both results. Equal checksums establish benchmark-output parity; unit and browser tests establish engineering/rendering parity.

## Change and dependency identity

The existing generated-symbol service now owns bounded preparation indexes:

- an exact unambiguous `(symbolId, versionId)` tuple map per immutable symbol-bundle array, preserving the previous first-match behavior for malformed duplicates and avoiding delimiter collisions;
- an asset-ID map per immutable asset-bundle array;
- modular terminal-block geometry per symbol bundle and immutable placement object, so occurrence IDs/module configuration cannot cross-contaminate another occurrence;
- structured terminal-strip geometry per symbol bundle and immutable asset object, allowing every representation of one asset to share its SVG, anchors, terminals and topology;
- a renderable symbol bundle per identical placement/symbol/asset array triple;
- bounded singleton or finite-kind values for configuration-free backplane, wire-tray, dimension, panel-reference and pattern-legend symbols.

All package-dependent caches use `WeakMap`. Superseded model arrays, placement objects, asset objects and symbol bundles can be reclaimed; no package ID or user data is held in a process-global strong map. The finite system-generated constants contain no package state. The drawing model is already immutable by command contract; new object identities invalidate conservatively.

Occurrence position, rotation, scale, tag and external title layout remain downstream render inputs and were not folded into shared symbols. Modular terminal SVG generation remains keyed by the complete placement object because its instance ID and module definition are occurrence-specific. Structured strip SVG generation remains keyed by its asset object because title, strip members, member attributes and configuration live there. A new symbol-bundle object invalidates module/member dependencies even if its records happen to compare equal.

## Parity and verification

Four direct cache contracts prove first-match exact lookup, adversarial colon-containing ID separation, same-placement terminal reuse, different-occurrence isolation, same-asset structured reuse, asset/symbol invalidation, byte-identical fresh/cached SVG and metadata, and exact-input render-bundle reuse. Existing structured-strip, generated-terminal, group, connection and destination-copy suites remain unchanged and pass.

- Focused: 5 files and 23 tests passed.
- Full regression: 125 files and 733 tests passed.
- Full lint, standalone typecheck and guarded production build passed. After adversarial tuple hardening, focused tests, typecheck, targeted lint and a second guarded production build passed. Final build ID: `J14CuxE6FRNK3iYf74K5l`; source fingerprint `8ef27b34961c41dcf53bf69fdc7cadc2b8d7f523d4535d48e2c9d42447d6d034`.
- Seven targeted production browser workflows passed: Wire Catalog lifecycle; internal-wire author/remove/restore/reload; PDF preview; selection arrangement/save/reload; structured terminal group creation; strip-member attribute projection; shared strip copy/representation.
- The full maintained production drawing gate passed 28/28 workflows, serially with no retries, in 2.3 minutes. After the delimiter-collision hardening, the generated terminal, shared strip and arrangement/save/reload workflows passed again on the final build; the clean-checkout CI will repeat the full gate before Stage3 is tagged.
- The final diagnostic structural workflow passed: presentation and Save retain zero source/graph rebuilds; a real model mutation retains one normalize/source/graph/history commit and zero requests.
- Port3100 was released. The live port3000 application was not restarted and the canonical database was never targeted.

## Stage3 assessment and retained limitations

Across Tasks009–013, unchanged presentation transitions no longer rebuild the graph; endpoint resolution dropped from approximately 57 ms to 4.3 ms in the controlled ABBA workload; reusable numeric collation reduced its repeated sort workload from approximately 998 ms to 36 ms; electrical-network p95 fell below 37 ms; normalization and rendering now share one final source; and exact/generated render preparation now produces the reductions above.

Task011's combined validation-plus-graph p95 of 108.27 ms remains visible against the 100 ms interpretation. This task does not relabel that combined metric as passing. One final structural diagnostic also observed noisy settled sheet timing above 250 ms and delayed selection resource requests; neither is attributed to this cache change. Stage4–6 address payload/catalogue and background request work, and Stage7 performs the final paired interaction assessment.

The first `task013-snapshot-parity` invocation used a phase name without the required `diagnostic-` prefix, so the structural test skipped by design. The corrected `diagnostic-task013-snapshot-parity` run passed. The skip is retained and not counted as verification.

## Recovery

Raw benchmark, build, diagnostic and browser evidence remains in unique ignored `task013-*` and `diagnostic-task013-*` paths. Source checkpoint: commit containing this report; publication review, push, exact remote verification and the Stage3 CI/tag result are recorded at task close and in the next Delivery update.
