import { prisma } from "@/lib/prisma";
import { parseMetadataJson } from "@/features/symbol_registry/api/public";
import type { ComponentAlternativeCandidate } from "../logic/services/component-definition-validator";

function supportsPanelLayout(metadata: ReturnType<typeof parseMetadataJson>) {
  return (
    (metadata.layoutUsage === "panel_layout" || metadata.layoutUsage === "both") &&
    typeof metadata.physicalWidthMm === "number" &&
    metadata.physicalWidthMm > 0 &&
    typeof metadata.physicalHeightMm === "number" &&
    metadata.physicalHeightMm > 0
  );
}

export async function listComponentAlternativeCandidates(): Promise<
  ComponentAlternativeCandidate[]
> {
  const symbols = await prisma.symbol.findMany({
    where: {
      status: "approved",
      category: { not: "network_device" }
    },
    select: {
      id: true,
      displayName: true,
      versions: {
        where: { status: "approved" },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          metadataJson: true
        }
      }
    },
    orderBy: [{ displayName: "asc" }, { symbolKey: "asc" }]
  });

  return symbols.flatMap((symbol) => {
    const version = symbol.versions[0];
    if (!version) {
      return [];
    }

    const metadata = parseMetadataJson(version.metadataJson);
    if (!supportsPanelLayout(metadata)) {
      return [];
    }

    return [
      {
        symbolId: symbol.id,
        displayName: symbol.displayName,
        versionId: version.id,
        versionNumber: version.versionNumber,
        metadata
      }
    ];
  });
}
