# PLAN-002-TASK-011 — Reusable numeric ordering experiment

Start: 2026-08-26 15:13 America/Port_of_Spain
End: 2026-08-26 15:19 America/Port_of_Spain
Duration: approximately 6 minutes
Status: complete; retained experiment

## Decision rule

Compare the current `String.localeCompare(undefined, { numeric: true })` behavior with one reusable `Intl.Collator(undefined, { numeric: true })` in the profiled electrical-network service. Retain a product change only if real and adversarial ordering are sign-equivalent and an ABBA benchmark shows repeatable benefit. Otherwise retain the current comparator and report the rejected experiment.

Predecessor: `ebca8db7484270f12888cca41f184d708736e19c`, remotely verified. No broader comparator consolidation was made.

## Equivalence and ABBA decision

The audit combines 12,281 real terminal-side, relationship, net and finding identifiers from the 120-sheet source fixture with adversarial numeric, zero-padded, case, punctuation, Unicode normalization, Greek and emoji identifiers. It checks all 961 adversarial pairs for comparison-sign equivalence, verifies exact sorted output across four real-data permutations and confirms checksum `49136`. Resolved locale was `en-US`, matching the predecessor's environment-dependent default.

Thirty observations per block after five warmups:

| Block order | Current median / p95 | Reused median / p95 |
|---|---:|---:|
| A | 998.12 / 1033.64 ms | 36.11 / 37.80 ms |
| B (reversed) | 997.75 / 1058.27 ms | 36.17 / 42.05 ms |

The reusable collator is sign/order-equivalent and approximately 96% faster for this repeated sorting workload in both ABBA positions. The experiment therefore meets its retain rule.

## Change

A small internal natural-ordering helper owns one `Intl.Collator(undefined, { numeric: true })`. Only the profiled electrical-network service now delegates its existing `naturalCompare` function to that helper. No other application comparator was changed, avoiding a broad ordering refactor.

A direct unit contract checks every adversarial pair against the previous numeric `localeCompare` expression and retains explicit `T1, T2, T10` order. The larger real-data equivalence remains in the guarded audit tool.

Files: internal natural-ordering helper/test; electrical-network service; audit-only comparison; Delivery records. No public API, saved data, engineering identity, graph shape, database or visual change.

## Integrated measurements

Compared with Task010's final refined source on the same 120-sheet fixture:

| Metric | Task010 median / p95 | Task011 median / p95 |
|---|---:|---:|
| Electrical network | 179.39 / 243.31 ms | 30.52 / 35.10 ms |
| Validated graph | 247.49 / 334.92 ms | 70.73 / 76.95 ms |
| Validation + graph | 265.28 / 370.10 ms | 99.55 / 108.27 ms |

An independent electrical-stage repeat produced `31.64/36.94 ms`, confirming the existing 100 ms electrical-network p95 budget now passes on the designated local fixture. The validated graph also passes. The combined validation+graph p95 remains 108.27 ms, so this report does not claim every source-processing interpretation is below 100 ms.

The candidate's drawable graph medians/p95s were mixed10 `4.16/10.45`, mixed40 `13.69/22.75`, mixed120 `46.64/54.10`, dense `18.07/27.38 ms`. These are batch observations; the same-run comparator ABBA and independent electrical repeat are the attribution evidence.

## Verification and risk

- Focused: 3 files, 14 tests passed.
- Full: 123 files, 726 tests passed.
- Full lint, standalone typecheck and guarded production build passed. Build ID: `DLwTHmqMl0SpF7RBg6lcv`.
- Four affected production browser workflows passed with one worker/no retry: structured jumper lifecycle, Wire Catalog lifecycle, internal-wire lifecycle and external-terminal mapping/reset.
- Port3100 is released. Existing live port3000 PID31720 was not restarted.

The collator is immutable, module-scoped and bounded; it stores no package or user data. It uses exactly the predecessor locale/options, and the explicit equivalence test fails if the runtime ever diverges for the adversarial set. Broader services retain their existing expressions and can be considered separately only with their own ordering contracts.

Evidence is retained under unique ignored paths `task011-ordering-abba`, `task011-candidate`, `task011-electrical-repeat`, focused/full/build/browser. Source checkpoint: commit containing this report; publication review, push and exact remote verification recorded at task close and in the next Delivery update.
