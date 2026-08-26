import { createLargePanelPerformanceSource } from "../../src/features/drawing_panel_wiring/tests/release-fixtures";
import { buildPackageConnectivityGraphFromValidatedSource } from "../../src/features/drawing_panel_wiring/logic/services/connectivity-graph";
import { guard, measure, write } from "./common";

guard();

const source = createLargePanelPerformanceSource();
const graph = buildPackageConnectivityGraphFromValidatedSource(source);
const adversarial = [
  "",
  "0",
  "00",
  "01",
  "1",
  "2",
  "02",
  "2a",
  "2A",
  "10",
  "T1",
  "T01",
  "T1.2",
  "T1.02",
  "T1.10",
  "T2",
  "T10",
  "a",
  "A",
  "á",
  "ä",
  "e\u0301",
  "é",
  "a-2",
  "a_2",
  "a:2",
  "a%202",
  "Ω2",
  "Ω10",
  "😀2",
  "😀10"
];
const actual = [...new Set([
  ...graph.terminalsById.keys(),
  ...graph.terminalSidesById.keys(),
  ...graph.conductiveRelationshipsById.keys(),
  ...graph.electricalNetsById.keys(),
  ...graph.findings.map((finding) => finding.id)
])];
const values = [...adversarial, ...actual];
const current = (first: string, second: string) =>
  first.localeCompare(second, undefined, { numeric: true });
const collator = new Intl.Collator(undefined, { numeric: true });
const reused = (first: string, second: string) => collator.compare(first, second);
const sign = (value: number) => Math.sign(value);

for (const first of adversarial) {
  for (const second of adversarial) {
    if (sign(current(first, second)) !== sign(reused(first, second))) {
      throw new Error(`Comparator mismatch for ${JSON.stringify(first)} / ${JSON.stringify(second)}`);
    }
  }
}

const currentSorted = [...values].sort(current);
const reusedSorted = [...values].sort(reused);
if (JSON.stringify(currentSorted) !== JSON.stringify(reusedSorted)) {
  throw new Error("Reusable collator changed real identifier ordering");
}
for (let index = 1; index < currentSorted.length; index += 1) {
  const first = currentSorted[index - 1];
  const second = currentSorted[index];
  if (sign(current(first, second)) !== sign(reused(first, second))) {
    throw new Error("Reusable collator changed an adjacent real comparison");
  }
}

const datasets = [
  values,
  [...values].reverse(),
  [...values.slice(1), values[0]],
  [...values.filter((_, index) => index % 2 === 0), ...values.filter((_, index) => index % 2 === 1)]
];
const sortChecksum = (compare: (first: string, second: string) => number) => {
  let checksum = 0;
  for (const dataset of datasets) {
    const sorted = [...dataset].sort(compare);
    checksum += sorted[0].length + sorted.at(-1)!.length + sorted.length;
  }
  return checksum;
};
const currentChecksum = sortChecksum(current);
const reusedChecksum = sortChecksum(reused);
if (currentChecksum !== reusedChecksum) throw new Error("Ordering checksum mismatch");

const blocks = [
  measure("ordering.current.a", () => sortChecksum(current)),
  measure("ordering.reused.a", () => sortChecksum(reused)),
  measure("ordering.reused.b", () => sortChecksum(reused)),
  measure("ordering.current.b", () => sortChecksum(current))
];
const result = {
  locale: collator.resolvedOptions().locale,
  identifiers: values.length,
  adversarialPairs: adversarial.length ** 2,
  datasets: datasets.length,
  checksum: currentChecksum,
  blocks
};
write("numeric-ordering-comparison.json", result);
console.log(JSON.stringify(result));
