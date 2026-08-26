# PLAN-002 — GitHub recovery map

Branch: `codex/drawing-performance-pass-1` in public repository `shello247/EandIDesigner`.

No commit or tag below authorizes a merge to `main` or live promotion.

| Recovery point | Tested source commit | Verification |
|---|---|---|
| Initial reviewed source | `a8338272ea99e79f1909a6e8edd3cf8fa95bd01e` | Public recovery baseline with known failures |
| Stage 0 | `72888c4c554b92862a7ea31f93c606069b47fb0c` | Recovery and isolated execution; tag `drawing-perf-pass-1-stage-0-20260826` |
| Stage 1 | `c63a0ef5db295103a2d0a9ecc9f9e161aacb9b83` | CI `32998854844`; tag `drawing-perf-pass-1-stage-1-20260826` |
| Stage 2 | `ab2dd18969bb4d9f4a18b8561607892cb3d4fec7` | CI `33001312593`; tag `drawing-perf-pass-1-stage-2-20260826` |
| Stage 3 | `a4c2d8ced508b22bc69a7b212ffd6271d1b52138` | CI `33007739398`; tag `drawing-perf-pass-1-stage-3-20260826` |
| Stage 4 | `25bc359e183329ed07217d946ea127feada3d9c9` | CI `33013450318`; tag `drawing-perf-pass-1-stage-4-20260826` |
| Stage 5 | `b7eb5ca1e527ccdfaa81373d50a87bcac129c9ba` | CI `33015096686`; tag `drawing-perf-pass-1-stage-5-20260826` |
| Stage 6 | `e8b406811a9dffa666a9bb9a10c569ab5d4dfd01` | CI `33017558582`; tag `drawing-perf-pass-1-stage-6-20260826` |
| Integrated memory-safe product | `11c91e71fd2ae522c2f4cf6d6732c1a9552fb58e` | 771 units, build, 30 browser workflows; product fingerprint `528deaa…` |
| Export-verified candidate | `d93c29f2f782e2e93a4e9671082b5f04de62e4ae` | CI `33020798725`; PDF/print parity; clean-checkout recovery rehearsal |

The final Stage 7 tag and final documentation checkpoint are added after publication and remote verification. Raw synthetic evidence remains ignored and local under `artifacts/drawing-performance/pass-1/`; GitHub is source recovery, not a database backup.

Rollback uses a corrective commit or targeted `git revert`; history must not be rewritten. The last verified stage tag is the restoration point appropriate to the scope being recovered.

