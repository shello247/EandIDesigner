import { symbolMetadataSchema } from "@/features/symbol_registry/api/metadata-contracts";
import { drawingModelSchema, listPhysicalProducts } from "@/features/drawing_canvas/api/audit-contracts";
import { isGeneratedDrawingAssetReference } from "@/features/drawing_canvas/api/generated-reference-contracts";
import { itemEngineeringProfileSchema, itemProfileV2Schema, itemProfileV3Schema } from "@/features/item_engineering/api/public";
import { deviceTypeSchema } from "@/shared/device-classification/device-types";
import { resolveAssetClassification } from "./asset-classification";
import type { ClassificationLookup } from "@/shared/device-classification/classification-resolution";

type Base = { id: string };
type Version = Base & { symbolId: string; versionNumber: number; deviceType: string | null; metadataJson: string; hasSvg: boolean };
type Revision = Base & { itemId: string; revisionNumber: number; identityJson: string; profileJson: string; contentHash: string;
  notes: Array<{ noteId: string }>; documents: Array<{ documentId: string }> };
export type ClassificationInventory = {
  symbols: Array<Base & { displayName: string }>;
  versions: Version[];
  items: Array<Base & { displayName: string }>;
  revisions: Revision[];
  drawings: Array<Base & { title: string; modelJson: string }>;
  configurations: Array<Base & { symbolVersionId: string; options: Array<Base & { itemEngineeringRevisionId: string; interfaceJson: string }>;
    parts: Array<Base & { itemEngineeringRevisionId: string }> }>;
  templates: Array<Base & { symbolId: string; lines: Array<Base & { itemId: string }> }>;
  attachments: Array<Base & { kind: string; ownerId: string | null; contentPresent: number }>;
};
export type AuditRecord = { key: string; kind: string; id: string; parentId?: string; label: string;
  issues: string[]; integrity: "passed" | "needs_review";
  outcome: "needs_evidence" | "needs_engineering_decision" | "historical_integrity_checked";
  reviewScope: string; used?: boolean };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
function parseJson(value: string) { return JSON.parse(value) as unknown; }

/** Closed census with per-record failures. Never infer engineering approval,
 * mutate drawings, upgrade references, or suppress malformed rows. */
export function auditClassificationInventory(input: ClassificationInventory) {
  const records: AuditRecord[] = [];
  const usedVersions = new Set<string>();
  const usedRevisions = new Set<string>();
  const versions = new Map(input.versions.map(row => [row.id, row]));
  const revisions = new Map(input.revisions.map(row => [row.id, row]));
  const symbolIds = new Set(input.symbols.map(row => row.id));
  const itemIds = new Set(input.items.map(row => row.id));
  const attachments = new Map(input.attachments.map(row => [row.id, row]));
  const configurations = new Map(input.configurations.map(row => [row.id, row]));
  const symbols: Record<string, ClassificationLookup> = {};
  const items: Record<string, ClassificationLookup> = {};
  const latestVersions = new Map<string, number>();
  const latestRevisions = new Map<string, number>();
  for (const row of input.versions) latestVersions.set(row.symbolId, Math.max(latestVersions.get(row.symbolId) ?? 0, row.versionNumber));
  for (const row of input.revisions) latestRevisions.set(row.itemId, Math.max(latestRevisions.get(row.itemId) ?? 0, row.revisionNumber));
  function add(kind: string, id: string, label: string, issues: string[] = [], parentId?: string) {
    const row: AuditRecord = { key: JSON.stringify([kind, parentId ?? null, id]), kind, id, parentId, label, issues,
      integrity: issues.length ? "needs_review" : "passed", outcome: "needs_evidence",
      reviewScope: "Automated structural checks only. Manufacturer requirements and installation conditions remain to be reviewed." };
    records.push(row); return row;
  }
  for (const row of input.symbols) add("symbol", row.id, row.displayName,
    latestVersions.has(row.id) ? [] : ["Symbol has no version."]);
  for (const row of input.items) add("item", row.id, row.displayName,
    latestRevisions.has(row.id) ? [] : ["Item has no engineering revision."]);
  for (const row of input.versions) {
    const issues: string[] = [];
    if (!symbolIds.has(row.symbolId)) issues.push("Missing parent Symbol.");
    if (!row.hasSvg) issues.push("Missing SVG artwork.");
    const type = deviceTypeSchema.nullable().safeParse(row.deviceType);
    if (!type.success) issues.push("Unrecognised Device Type.");
    else if (!type.data) issues.push("Device Type requires explicit classification.");
    try {
      const metadata = symbolMetadataSchema.parse(parseJson(row.metadataJson));
      const anchors = new Set(metadata.anchors.map(anchor => anchor.key));
      for (const terminal of metadata.terminals) if (!anchors.has(terminal.anchorKey)) issues.push(`Terminal ${terminal.key} has no matching anchor.`);
    } catch (error) { issues.push(`Invalid Symbol metadata: ${message(error)}`); }
    symbols[row.id] = type.success ? { state: "available", source: { kind: "symbol_version", recordId: row.symbolId, revisionId: row.id, deviceType: type.data } }
      : { state: "unavailable", recordId: row.symbolId, revisionId: row.id, reason: "Malformed Device Type." };
    add("symbol_version", row.id, `Version ${row.versionNumber}`, issues, row.symbolId);
  }
  for (const row of input.revisions) {
    const issues: string[] = [];
    if (!itemIds.has(row.itemId)) issues.push("Missing parent Item.");
    try {
      const raw = parseJson(row.profileJson);
      const profile = itemProfileV3Schema.or(itemProfileV2Schema).or(itemEngineeringProfileSchema).parse(raw);
      parseJson(row.identityJson);
      items[row.id] = { state: "available", source: { kind: "item_revision", recordId: row.itemId, revisionId: row.id, deviceType: profile.deviceType } };
    } catch (error) { issues.push(`Invalid Item revision: ${message(error)}`); }
    if (!/^[a-f0-9]{64}$/.test(row.contentHash)) issues.push("Malformed historical content hash.");
    for (const link of [...row.notes.map(n => n.noteId), ...row.documents.map(d => d.documentId)]) {
      const evidence = attachments.get(link);
      if (!evidence || evidence.ownerId !== row.itemId) issues.push(`Missing or wrong-owner evidence: ${link}.`);
    }
    add("item_revision", row.id, `Revision ${row.revisionNumber}`, issues, row.itemId);
  }
  for (const row of input.configurations) {
    const issues: string[] = [];
    if (!versions.has(row.symbolVersionId)) issues.push("Missing exact Symbol version.");
    for (const part of [...row.options, ...row.parts]) {
      if (!revisions.has(part.itemEngineeringRevisionId)) issues.push(`Missing exact Item revision ${part.itemEngineeringRevisionId}.`);
      usedRevisions.add(part.itemEngineeringRevisionId);
    }
    for (const option of row.options) { try { parseJson(option.interfaceJson); } catch { issues.push(`Malformed terminal mapping for option ${option.id}.`); } }
    add("product_configuration", row.id, row.id, issues, row.symbolVersionId);
    for (const option of row.options) add("product_option", option.id, option.itemEngineeringRevisionId, issues.filter(i => i.includes(option.id) || i.includes(option.itemEngineeringRevisionId)), row.id);
    for (const part of row.parts) add("additional_product_part", part.id, part.itemEngineeringRevisionId, revisions.has(part.itemEngineeringRevisionId) ? [] : ["Missing Item revision."], row.id);
  }
  for (const row of input.templates) {
    add("mini_bom", row.id, row.id, symbolIds.has(row.symbolId) ? [] : ["Missing Symbol."], row.symbolId);
    for (const line of row.lines) add("mini_bom_line", line.id, line.itemId, itemIds.has(line.itemId) ? [] : ["Missing Item."], row.id);
  }
  for (const row of input.attachments) add(row.kind, row.id, row.id,
    [...(!row.contentPresent ? ["Attachment content unavailable."] : []),
      ...(row.ownerId && !(row.kind === "symbol_source" ? symbolIds : itemIds).has(row.ownerId) ? ["Missing attachment owner."] : [])], row.ownerId ?? undefined);

  for (const drawing of input.drawings) {
    const drawingRecord = add("drawing", drawing.id, drawing.title);
    try {
      const raw = parseJson(drawing.modelJson);
      const parsed = drawingModelSchema.safeParse(raw);
      if (!parsed.success) throw new Error(parsed.error.message);
      const model = parsed.data;
      const assetIds = new Set(model.assets.map(asset => asset.id));
      const assetsById = new Map(model.assets.map(asset => [asset.id, asset]));
      const tags = new Set<string>();
      const seenIds = new Set<string>();
      for (const asset of model.assets) {
        const issues: string[] = [];
        if (seenIds.has(asset.id)) issues.push("Duplicate physical asset identity."); seenIds.add(asset.id);
        if (tags.has(asset.tag.toUpperCase())) issues.push("Tag used by another physical asset."); tags.add(asset.tag.toUpperCase());
        const resolution = resolveAssetClassification(asset, { symbols, items });
        issues.push(...resolution.issues.map(issue => issue.message));
        if (resolution.status !== "resolved" && !issues.length) issues.push(`Classification ${resolution.status}.`);
        add("asset", asset.id, asset.tag, issues, drawing.id);
        // Isolate malformed/deep assemblies: one failure cannot conceal the other assets.
        try {
          const products = listPhysicalProducts({ ...model, assets: [asset] });
          for (const product of products) {
            const productIssues: string[] = [];
            const generatedRoot = !product.target.memberId && product.target.componentPath.length === 0 &&
              isGeneratedDrawingAssetReference(asset);
            if (product.versionId && !generatedRoot) {
              usedVersions.add(product.versionId);
              if (versions.get(product.versionId)?.symbolId !== product.symbolId) productIssues.push("Missing or wrong-owner pinned Symbol version.");
            }
            if (product.selection) {
              const configuration = configurations.get(product.selection.configurationId);
              if (!configuration || configuration.symbolVersionId !== product.versionId) productIssues.push("Missing or mismatched product configuration.");
              if (product.selection.status === "selected") {
                const selection = product.selection;
                usedRevisions.add(selection.itemEngineeringRevisionId);
                if (revisions.get(selection.itemEngineeringRevisionId)?.itemId !== selection.itemId) productIssues.push("Missing or wrong-owner pinned Item revision.");
                if (!configuration?.options.some(o => o.itemEngineeringRevisionId === selection.itemEngineeringRevisionId)) productIssues.push("Selected Item is not an option in the pinned configuration.");
              }
            }
            add("physical_product", product.key, product.label, productIssues, drawing.id);
          }
        } catch (error) { drawingRecord.issues.push(`Assembly ${asset.tag}: ${message(error)}`); }
      }
      for (const sheet of model.sheets) {
        add("sheet", sheet.id, sheet.name, [], drawing.id);
        const seenPlacements = new Set<string>();
        for (const placement of sheet.placements) {
          const issues: string[] = [];
          if (seenPlacements.has(placement.id)) issues.push("Duplicate occurrence ID on sheet."); seenPlacements.add(placement.id);
          if (placement.assetId && !assetIds.has(placement.assetId)) issues.push("Occurrence references a missing managed asset.");
          if (placement.containerAssetId && !assetIds.has(placement.containerAssetId)) issues.push("Missing owning container.");
          const owningAsset = placement.assetId ? assetsById.get(placement.assetId) : undefined;
          const generatedOccurrence = owningAsset && isGeneratedDrawingAssetReference(owningAsset) &&
            placement.symbolId === owningAsset.symbolId && placement.versionId === owningAsset.versionId;
          if (placement.versionId && versions.has(placement.versionId)) {
            usedVersions.add(placement.versionId);
            if (versions.get(placement.versionId)?.symbolId !== placement.symbolId) issues.push("Wrong-owner pinned Symbol version.");
          } else if (placement.versionId && !generatedOccurrence) {
            // Generated IDs are also checked in the manual audit; do not fabricate a catalogue source.
            issues.push("Version is not in the catalogue; verify generated-helper applicability or repair missing reference.");
          }
          add("occurrence", placement.id, placement.tag, issues, `${drawing.id}/${sheet.id}`);
        }
      }
    } catch (error) {
      drawingRecord.issues.push(`Drawing parse failed; nested census incomplete: ${message(error)}`);
    }
  }
  for (const row of records) {
    row.integrity = row.issues.length ? "needs_review" : "passed";
    if (row.issues.length) row.outcome = "needs_engineering_decision";
    if (row.kind === "symbol_version") {
      const source = versions.get(row.id)!;
      row.used = usedVersions.has(row.id);
      if (!row.used && source.versionNumber !== latestVersions.get(source.symbolId) && !row.issues.length) {
        row.outcome = "historical_integrity_checked";
        row.reviewScope = "Unused historical version: metadata schema, parent reference, artwork presence and Device Type only; no manufacturer revalidation.";
      }
    }
    if (row.kind === "item_revision") {
      const source = revisions.get(row.id)!;
      row.used = usedRevisions.has(row.id);
      if (!row.used && source.revisionNumber !== latestRevisions.get(source.itemId) && !row.issues.length) {
        row.outcome = "historical_integrity_checked";
        row.reviewScope = "Unused historical revision: schema and linked-evidence ownership only; hash format checked, digest verification pending.";
      }
    }
  }
  return { records, counts: Object.fromEntries([...new Set(records.map(r => r.kind))].map(kind => [kind, records.filter(r => r.kind === kind).length])),
    issueCount: records.reduce((sum, row) => sum + row.issues.length, 0),
    limitations: ["Saved records only; unsaved drafts are not included.", "Manufacturer review, visual evidence review, digest recomputation and application-specific installation assessment are separate required gates.",
      "A failed drawing parse prevents a complete nested census and must be resolved or individually inventoried before audit completion."] };
}
