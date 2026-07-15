# Detailed Panel Drawings Controlled Pilot

This guide is the release and recovery reference for Detailed Panel Drawings.
The feature builds electrical detail drawings from package asset and terminal
identity; it does not infer identity from rendered SVG, labels, or tag prefixes.

## Runtime Architecture

- Edit mode mounts one active sheet. Sheet Loader changes the active sheet.
- Package Preview is read-only, keeps exact page placeholders, and mounts no more
  than 12 nearby sheet SVGs.
- `PanelEngineeringSnapshot` contains one validated source and one connectivity
  graph per immutable model/symbol revision.
- Panel Work Queue, Review, and Deliverables consume the shared graph. QC is built
  only when Review, approval, or Deliverables needs it.
- `PanelReportIndex` builds route, terminal, occurrence, pattern, and finding
  lookups once for all report rows.
- Pointer gestures use transient `CanvasGestureDraft` state. Pointer-up creates
  one model commit and undo entry; Escape/pointer-cancel creates none.
- Save and approval send `expectedUpdatedAt`. A conflict preserves local state and
  offers local JSON download or an explicit reload.

## Feature Control

Set `DETAILED_PANEL_DRAWINGS_ENABLED=false` to enter recovery/read-only mode.

- Existing Detailed Panel sheets, Package Preview, Review, and exports remain
  readable.
- New Detailed Panel sheets, component placement, mappings, wires, patterns,
  edits, approval, and agent application are blocked.
- Unrelated field drawing sheets remain editable and save normally.
- Server save validation rejects changes to Detailed Panel sheets, canonical
  panel wiring, or protected referenced assets.

Unset the variable or set it to `true` for the controlled pilot.

## Performance Gate

Run after a production build on the designated Windows/Chromium workstation:

```powershell
$env:DATABASE_URL='file:./dev.db'
npx next build --webpack
$env:PANEL_PERF_ENFORCE='1'
npm run test:panel-perf
```

The deterministic fixture contains 120 sheets, 20 panels, 500 assets, 2,000
logical terminals, 2,000 visual connections, 1,000 internal wires, and 250
connection patterns. Results are written to
`artifacts/panel-performance/latest.json`; the file contains durations and counts
only and is not telemetry.

| Operation | p95 budget |
| --- | ---: |
| Source validation plus connectivity graph | 100 ms |
| Package QC | 150 ms |
| Active-panel catalogs and QC | 75 ms |
| Active-panel deliverables | 75 ms |
| All-panel deliverables | 200 ms |
| Search/filter/sort for 2,000 rows | 100 ms |
| Warm Sheet Loader transition | 250 ms |
| Pointer preview frame | 16.7 ms |

Browser QA must additionally confirm one commit per completed gesture, no pointer
task over 50 ms, and no more than 12 mounted Package Preview SVG pages.

## Agent-Safe Boundary

Phase 10 adds no AI model or autonomous UI. Future agents may use only these
structured operations:

- `inspectPanelAgentContext`
- `listUnresolvedPanelTerminations`
- `proposeExternalTerminationMappingPlan`
- `proposeInternalWirePlan`
- `validatePanelAgentPlan`
- `applyApprovedPanelAgentPlan`

Every plan contains the exact drawing revision, panel, sheet, occurrence, anchor,
asset, terminal, and side identities; canonical mutation previews; affected IDs;
warnings; and a SHA-256 digest. Application requires the exact approved digest,
the same saved `updatedAt`, feature availability, and complete command
revalidation. Approved and archived drawings reject agent changes. Successful
agent mutations use `origin: "agent"` and require persistence as `needs_review`.

Example envelope:

```json
{
  "schemaVersion": 1,
  "drawingId": "drawing-id",
  "panelAssetId": "panel-asset-id",
  "baseUpdatedAt": "2026-07-11T12:00:00.000Z",
  "operation": {
    "kind": "external_termination_mapping",
    "terminationId": "external:...",
    "source": {
      "sheetId": "field-sheet-id",
      "connectionId": "connection-id",
      "endpointRole": "to",
      "placementId": "terminal-occurrence-id",
      "anchorKey": "T1_BOTTOM"
    },
    "target": {
      "assetId": "terminal-asset-id",
      "terminalKey": "T1",
      "side": "external"
    }
  },
  "mutationPreview": [],
  "warnings": [],
  "affectedIds": [],
  "digest": "64-character-sha256"
}
```

Agents must never select physical identity by tag similarity, edit raw
`Drawing.modelJson`, bypass terminal occupancy, or change an issued drawing.

## JB001 Pilot Script

1. Load the JB001 Detailed Panel Drawing through Sheet Loader.
2. Open Panel Work Queue. Confirm TB-101 through TB-104 and every field
   termination/source sheet are discovered without new assets.
3. Place the existing terminal occurrences and map one intentionally unresolved
   external termination. Save, reload, and verify the override.
4. Place or reference one approved internal component. Confirm its canonical
   terminals in Properties and Asset Manager.
5. Create an internal wire from a free terminal-block internal side. Move both
   components, edit the route, undo, and redo. Confirm one history step per
   gesture.
6. Create one jumper and one valid shield/PE relationship. Confirm duplicate
   membership is blocked.
7. Run Panel Review. Repair all blocking findings and approve the package.
8. Generate terminal, wire, asset, and BOM schedules; CSV; XLSX; schedule PDF;
   and drawing-plus-schedule PDF.
9. Save/reload and repeat discovery and report counts. Confirm no duplicate
   assets, field connections, internal wires, or patterns.
10. Open Package Preview, scroll the package, return to editing, and verify the
    prior sheet/viewport is restored.

## Generic MCP-201 Script

The automated generic fixture is a normal panel, not a junction box. It uses tag
`MCP-201` and terminal strips with 8, 12, and 4 terminals.

1. Confirm the graph discovers 24 logical terminals without JB/TB naming rules.
2. Create/load its Detailed Panel Drawing and repeat asset discovery, mapping,
   component placement, wiring, QC, and deliverables.
3. Confirm all references use MCP asset IDs and its `panel` type.
4. Confirm no JB001 tags, terminal counts, or source-sheet assumptions appear.

## Troubleshooting

- **Save conflict:** Download the local JSON before reloading. The application
  never merges revisions automatically.
- **Review updating:** Wait for the deferred committed revision. Repair commands
  revalidate and reject stale proposals.
- **Missing work queue record:** Verify physical `assetId`, `containerAssetId`,
  approved symbol version, and terminal metadata. Do not repair by changing tags.
- **Wire endpoint unavailable:** Check side, occupancy, panel context,
  occurrence, and anchor metadata.
- **Issued export disabled:** Save, clear blocking QC, approve, then request the
  issued deliverable again.
- **Slow package:** Enable `NEXT_PUBLIC_DRAWING_PERF_DIAGNOSTICS=true`, reproduce
  once, and inspect `window.__EI_DRAWING_PERFORMANCE_SAMPLES__`. Samples stay in
  memory and contain no engineering content.
- **Pilot rollback:** Set `DETAILED_PANEL_DRAWINGS_ENABLED=false`, restart, and
  verify read-only access and exports. Optional panel JSON is retained.

## Release Checklist

- Full Vitest and lint suites pass.
- Production webpack build passes against the pilot database configuration.
- Both release Playwright workflows pass serially.
- Enforced performance fixture passes every non-browser budget.
- JB001 and MCP-201 manual scripts pass with zero blocking QC findings.
- Draft and issued CSV/XLSX/PDF outputs are checked.
- Optimistic save conflict and local-copy recovery are demonstrated.
- Read-only feature-flag rollback is demonstrated.
- Field drawings, layouts, dimensions, templates, duplication, clipboard, Asset
  Manager, BOM Creator, print, and PDF regressions pass.

## Deferred Work

- Worker-based graph and report construction beyond the supported V1 scale.
- Authenticated agent approval history and immutable issued revisions.
- Terminal capacity and multi-conductor hardware models.
- Automatic routing and vendor-specific electrical templates.
