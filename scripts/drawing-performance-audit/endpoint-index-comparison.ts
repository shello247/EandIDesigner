import { createLargePanelPerformanceSource } from "../../src/features/drawing_panel_wiring/tests/release-fixtures";
import { buildPackageConnectivityGraphFromValidatedSource } from "../../src/features/drawing_panel_wiring/logic/services/connectivity-graph";
import { guard, measure, write } from "./common";

guard();

const source = createLargePanelPerformanceSource();
const graph = buildPackageConnectivityGraphFromValidatedSource(source);
const queries = source.sheets.flatMap((sheet) =>
  sheet.connections.flatMap((connection) => [
    { sheetId: sheet.id, connectionId: connection.id, endpointRole: "from" as const },
    { sheetId: sheet.id, connectionId: connection.id, endpointRole: "to" as const }
  ])
);
const key = (value: (typeof queries)[number]) =>
  `${encodeURIComponent(value.sheetId)}:${encodeURIComponent(value.connectionId)}:${value.endpointRole}`;

function scanEveryEndpoint(): number {
  let checksum = 0;
  for (const query of queries) {
    const match = [...graph.externalTerminationsById.values()].find(
      (candidate) =>
        candidate.status === "resolved" &&
        candidate.source.sheetId === query.sheetId &&
        candidate.source.connectionId === query.connectionId &&
        candidate.source.endpointRole === query.endpointRole
    );
    checksum += match?.id.length ?? 0;
  }
  return checksum;
}

function buildThenLookup(): number {
  const index = new Map<string, string>();
  for (const candidate of graph.externalTerminationsById.values()) {
    if (candidate.status !== "resolved") continue;
    const candidateKey = key(candidate.source);
    if (!index.has(candidateKey)) index.set(candidateKey, candidate.id);
  }
  let checksum = 0;
  for (const query of queries) checksum += index.get(key(query))?.length ?? 0;
  return checksum;
}

const scanChecksum = scanEveryEndpoint();
const indexedChecksum = buildThenLookup();
if (scanChecksum !== indexedChecksum) {
  throw new Error("Indexed endpoint lookup changed first-resolved semantics");
}

const blocks = [
  measure("endpoint.scan.a", scanEveryEndpoint),
  measure("endpoint.index.a", buildThenLookup),
  measure("endpoint.index.b", buildThenLookup),
  measure("endpoint.scan.b", scanEveryEndpoint)
];
const result = {
  shape: {
    sheets: source.sheets.length,
    connections: queries.length / 2,
    endpoints: queries.length,
    externalTerminations: graph.externalTerminationsById.size,
    checksum: indexedChecksum
  },
  blocks
};
write("endpoint-index-comparison.json", result);
console.log(JSON.stringify(result));
