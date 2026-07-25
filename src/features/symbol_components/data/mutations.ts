import { prisma } from "@/lib/prisma";
import {
  parseMetadataJson,
  stringifyMetadata
} from "@/features/symbol_registry/api/public";
import {
  updateSymbolComponentsInputSchema,
  type UpdateSymbolComponentsInput
} from "./schema";
import { listComponentAlternativeCandidates } from "./queries";
import { validateSymbolComponentDefinitions } from "../logic/services/component-definition-validator";

export async function updateSymbolComponents(
  input: UpdateSymbolComponentsInput
): Promise<{ symbolId: string }> {
  const parsed = updateSymbolComponentsInputSchema.parse(input);
  const version = await prisma.symbolVersion.findUnique({
    where: { id: parsed.versionId },
    include: { symbol: true }
  });

  if (!version) {
    throw new Error("Symbol version was not found.");
  }

  if (version.symbol.status === "archived") {
    throw new Error("Archived symbols are immutable.");
  }

  if (version.status !== "draft" && version.status !== "needs_review") {
    throw new Error("Only draft or needs-review symbol versions can be edited.");
  }

  const metadata = parseMetadataJson(version.metadataJson);
  const updatedMetadata = {
    ...metadata,
    componentPositions:
      parsed.componentPositions.length > 0
        ? parsed.componentPositions
        : undefined
  };
  const candidates = await listComponentAlternativeCandidates();
  const issues = validateSymbolComponentDefinitions({
    parentSymbolId: version.symbolId,
    metadata: updatedMetadata,
    candidates
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.symbolVersion.update({
      where: { id: version.id },
      data: {
        metadataJson: stringifyMetadata(updatedMetadata),
        status: "needs_review"
      }
    });
    await transaction.symbol.update({
      where: { id: version.symbolId },
      data: { status: "needs_review" }
    });
    await transaction.symbolValidationIssue.deleteMany({
      where: {
        symbolId: version.symbolId,
        versionId: version.id,
        code: { startsWith: "COMPONENT_" }
      }
    });
    if (issues.length > 0) {
      await transaction.symbolValidationIssue.createMany({
        data: issues.map((issue) => ({
          symbolId: version.symbolId,
          versionId: version.id,
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          path: issue.path
        }))
      });
    }
  });

  return { symbolId: version.symbolId };
}
