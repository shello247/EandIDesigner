import { auditSymbol, mixedModel } from "./fixtures";
import { guard, sha, write } from "./common";
import { drawingPackageModelSchema } from "../../src/features/drawing_canvas/data/schema";
import { collectDrawingSymbolVersionIds } from "../../src/features/drawing_canvas/logic/services/drawing-symbol-version-references";
import { getRenderableSymbolForPlacement } from "../../src/features/drawing_canvas/logic/services/drawing-generated-symbols";
import { resolveTerminalBlockModuleForDefinition } from "../../src/features/drawing_terminal_blocks/logic/services/terminal-block-groups";

guard();
const model=mixedModel(10);
const oldModule={...auditSymbol(24),versionId:"audit_terminal_module_v1",category:"terminal_block" as const,metadata:{...auditSymbol(24).metadata,category:"terminal_block" as const}};
const newerModule={...oldModule,versionId:"audit_terminal_module_v2",versionNumber:2};
const placement=model.sheets[0].placements.find(item=>item.terminalBlock)!;
placement.terminalBlock={...placement.terminalBlock!,moduleTemplate:{symbolId:oldModule.symbolId,versionId:oldModule.versionId,pitchMm:30,heightMm:50}};
model.assets.find(asset=>asset.id===placement.assetId)!.terminalBlock=placement.terminalBlock;
const validated=drawingPackageModelSchema.parse(model);
const requested=collectDrawingSymbolVersionIds(validated);
const withoutPinned=getRenderableSymbolForPlacement(placement,[auditSymbol(),newerModule],validated.assets)!;
const withPinned=getRenderableSymbolForPlacement(placement,[auditSymbol(),newerModule,oldModule],validated.assets)!;
write("pinned-module-dependency-probe.json",{
  at:new Date().toISOString(),classification:"reproduced in synthetic pure-service probe; not a saved-package browser reproduction",
  placedVersionIncluded:requested.includes(auditSymbol().versionId),
  generatedModulePinnedVersionIncluded:requested.includes(oldModule.versionId),
  resolvedWithLatestOnly:Boolean(resolveTerminalBlockModuleForDefinition(placement.terminalBlock,[newerModule])),
  resolvedWhenPinnedSupplied:Boolean(resolveTerminalBlockModuleForDefinition(placement.terminalBlock,[newerModule,oldModule])),
  generatedSvgChanges:withoutPinned.svg!==withPinned.svg,
  latestOnlySvgSha256:sha(withoutPinned.svg),withPinnedSvgSha256:sha(withPinned.svg)
});
