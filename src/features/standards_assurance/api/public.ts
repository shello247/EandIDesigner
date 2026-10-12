import { getRevision } from "../data/queries";
import { getStandardsContext } from "../data/context";
export { getRequirementTrace } from "../data/queries";
export { getSnapshot } from "../data/queries";
export { snapshotHtml, snapshotJson } from "../logic/services/standards-export";
export { getStandardsContext } from "../data/context";
export async function getStandardsProfile(profileRevisionId: string) { return getRevision("profile", profileRevisionId); }
export async function getImplementationCoverage(profileRevisionId: string) { return (await getStandardsContext(profileRevisionId)).coverage; }
export type { StandardsContext, Coverage, Trace, Snapshot, Revision } from "../types";
