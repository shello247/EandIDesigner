import { collectComponentSelectionVersionIds } from "@/features/symbol_components/api/public";
import type { DrawingModel } from "../../data/schema";

// These IDs are reserved by the in-memory drawing generators. Keep this list
// exact: a broad "generated" prefix check could discard a legitimate pinned
// registry version. The closure test imports every generator constant so ID
// drift fails visibly.
const SYSTEM_GENERATED_DRAWING_VERSION_IDS = new Set([
  "generated_terminal_block_v1",
  "generated_panel_enclosure_v1",
  "generated_backplane_v1",
  "generated_wire_tray_v1",
  "generated_horizontal_dimension_v1",
  "generated_vertical_dimension_v1",
  "generated_panel_connection_view_v1",
  "generated_panel_reference_v1",
  "generated_panel_pattern_legend_v1",
  "generated_terminal_block_group_builder_v1"
]);

const GENERATED_STRUCTURED_TERMINAL_STRIP_VERSION_PREFIX =
  "generated_structured_terminal_strip_v1:";

function isSystemGeneratedDrawingVersionId(versionId: string): boolean {
  return (
    SYSTEM_GENERATED_DRAWING_VERSION_IDS.has(versionId) ||
    versionId.startsWith(GENERATED_STRUCTURED_TERMINAL_STRIP_VERSION_PREFIX)
  );
}

export function collectDrawingSymbolVersionIds(model: DrawingModel): string[] {
  const versionIds = new Set<string>();
  const add = (versionId: string | undefined) => {
    if (versionId && !isSystemGeneratedDrawingVersionId(versionId)) {
      versionIds.add(versionId);
    }
  };
  const addComponentSelections = (
    selections: Parameters<typeof collectComponentSelectionVersionIds>[0]
  ) => {
    for (const versionId of collectComponentSelectionVersionIds(selections)) {
      add(versionId);
    }
  };

  for (const sheet of model.sheets) {
    for (const placement of sheet.placements) {
      add(placement.versionId);
      add(placement.terminalBlock?.moduleTemplate?.versionId);
    }
  }

  for (const asset of model.assets) {
    add(asset.versionId);
    add(asset.terminalBlock?.moduleTemplate?.versionId);
    addComponentSelections(asset.componentSelections);

    for (const member of asset.terminalStrip?.members ?? []) {
      add(member.versionId);
      addComponentSelections(member.componentSelections);
    }
  }

  return [...versionIds];
}
