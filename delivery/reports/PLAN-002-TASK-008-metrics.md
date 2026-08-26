# PLAN-002-TASK-008 — Accurate bounded drawing metrics

Start: 2026-08-26 14:32 America/Port_of_Spain
End: 2026-08-26 14:43 America/Port_of_Spain
Duration: approx 11m
Status: done

## Purpose and changes

PLAN-001 incorrectly described the synchronous state-dispatch wrapper as complete sheet-loading time. The product sample is now named `canvas.sheet-dispatch`. The audit action record separately reports:

- `calculationStages`: only product samples correlated to the action ID and current edit revision;
- `settledInteractionMs`: user input through the tested state/DOM condition plus two animation frames;
- `automationWallMs`: complete automation overhead; and
- legacy `elapsedMs` as an explicit alias of settled time for frozen evidence readers.

The existing diagnostics service now maintains bounded400sample detail and fixed-name aggregate invocation counters. It records graph/source/projection/schedule/SVG/normalization/gesture/history stages. Context carries an opaque action ID and `edit:<revision>` only—never document data. The service returns immediately before reading the clock or allocating when disabled (the production default). Editor-local tests can enable it before hydration. Task009 can now assert exact graph/source invocation changes without retaining the temporary AST instrumentation from PLAN-001.

The audit Playwright configuration gained the same guarded owned production-server lifecycle as the release gate. It still refuses an existing port3100 listener and uses only the validated synthetic database. Gesture assertions use the shipped `canvas.history-commit` counter instead of temporary `pushDrawingHistoryEntry` instrumentation.

Files: drawing-performance-diagnostics.ts and test; drawing-canvas-shell.tsx; audit browser metrics/spec/config and contract test; Delivery records. No database, model, wire/terminal, visual, save or public API change.

## Evidence

Predecessor Task007 checkpoint `7d1c97a6945508733a6f4808af05a3778b5a6cde`, remote verified. No controlled timing gain is expected or claimed from measurement code.

`task008-contracts` and `task008-contracts-v2`: focused contracts pass; final v2 is3tests/2files. Tests prove zero clock/allocation/global work while disabled, exact operation return,400sample bound,405aggregate count, action/revision correlation and defensive counter copies. The audit measurement contract proves a36ms settled interaction remains distinct from its12ms correlated graph stage and41ms automation wall. Full typecheck passes. Fingerprint `ad28f328a4b1fa9205c6e17b0ee02d1e0e78b123ac3baddf5fe17fdf02730208` before final audit-server additions.

Production build, disabled/enabled diagnostic parity, structural gestures, lint/full regression and publication are complete below. All failures/outliers remain under unique guarded artifact paths.

First production diagnostic batch `diagnostic-task008-browser`:2tests pass in1.6m on the40-sheet/360-placement fixture. Each disabled/enabled block has30measured selections after5warmups; disabled blocks record0stages, enabled blocks consistently record6correlated calculation stages. Settled-selection medians in execution order are93.5ms disabled,76.6ms enabled,75.0ms enabled and78.2ms disabled. This reversed block order indicates no observed diagnostic regression, but it is not used to claim a speedup. Move/resize/rotate each record exactly1history commit and0network requests across90measured gestures; respective settled medians368.4/401.1/369.1ms include automated8-step pointer travel and settlement, not pointer-preview frame duration. Stage counts18–26 expose the repeated-calculation work assigned to Tasks009–013. No thresholds are relabelled or waived.

`diagnostic-task008-parity-final` retains1failed/1passed: geometry and identity again pass; the new assertion shows revision correlation survives only the first measured action because audit cleanup cleared the whole context. Product code correctly supplied `edit:0`; the audit now clears only the transient action ID while retaining the revision. This is an audit-contract correction, not an application workaround. Final rerun required.

Final `diagnostic-task008-parity-v2` passes: disabled block medians67.6/77.8ms with0stages/counters; enabled blocks both66.0ms with exactly6stages and `edit:0` on every sample. This controlled sequence finds no instrumentation regression but is not evidence of a speedup. `task008-wire-catalog-sync` passes the previously Linux-racy workflow after waiting for its existing close control to re-enable. Full719tests/121files, full typecheck, full lint and production build pass. Final fingerprint `25084ae99debb201f8121838860c001c60e994505ebb4bd85221f2a1a54771cd`; build `du30EUy9kGYYUnBNzMj8F`. No3100listener remains; original audited source matches.

GitHub checkpoint `ab2dd18969bb4d9f4a18b8561607892cb3d4fec7` was publication-reviewed (15files, zero findings), pushed and exact remote branch SHA verified. Clean-checkout CI33001312593 passes audit/lint/types/719units/harness/bootstrap/build and all28production drawing workflows with one worker, zero retries and automatic page/popup-error checks. Annotated tag `drawing-perf-pass-1-stage-2-20260826` is remote verified and peels to this tested commit. Existing GitHub action Node-runtime deprecation warning remains non-fatal and deferred; no live promotion.

## Risk controls

Counters are editor-global only when explicitly enabled and are reset per measured action. Detail and key cardinality are bounded; no global package cache is introduced. Timing is synchronous calculation duration, not paint/readiness. Browser settlement remains a measured test condition—not a product state setter. Temporary PLAN-001 instrumentation is not shipped or rerun against product source.
