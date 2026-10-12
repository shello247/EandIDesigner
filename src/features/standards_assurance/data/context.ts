import { prisma } from "@/lib/prisma";
import type { StandardsContext, ProfileRow } from "../types";
import { getCurrent, getRequirementTrace, getRevision, getReviews, type Db } from "./queries";
import { calculateCoverage, evidenceFreshness } from "../logic/services/standards-coverage";
import { standardsBuildId } from "../logic/services/standards-build";
import { StandardsError } from "../logic/services/standards-errors";
import { contentHash } from "../logic/services/standards-hash";
export async function getStandardsContext(profileRevisionId: string, db: Db = prisma, buildId = standardsBuildId()): Promise<StandardsContext> {
  const profile = await getRevision("profile", profileRevisionId, db);
  // Bound fan-out; profile schema caps entries at 250 and each chunk uses at most eight traces.
  const rows: ProfileRow[] = [];
  for (let start = 0; start < profile.content.entries.length; start += 8) {
    const chunk = await Promise.all(profile.content.entries.slice(start, start + 8).map(async entry => {
      const [trace, implementation, implementationReviews] = await Promise.all([
        getRequirementTrace(entry.requirementRevisionId, db),
        entry.implementationRevisionId ? getRevision("implementation", entry.implementationRevisionId, db) : Promise.resolve(null),
        entry.implementationRevisionId ? getReviews("implementation", entry.implementationRevisionId, db) : Promise.resolve([])
      ]);
      if (implementation && implementation.content.requirementRevisionId !== trace.requirement.id) throw new StandardsError("inconsistent_reference", "Profile contains an incompatible implementation revision.");
      const currentImplementation = implementation ? await getCurrent("implementation", implementation.entityId, db) : null;
      return { entry, trace, implementation, implementationReviews, evidence: trace.evidence.map(e => evidenceFreshness(e, trace, implementation, buildId, currentImplementation?.id ?? null)) };
    }));
    rows.push(...chunk);
  }
  const assessment = { profile, rows, coverage: calculateCoverage(rows), buildId, reviews: await getReviews("profile", profile.id, db) };
  return { ...assessment, assessmentHash: contentHash(assessment) };
}
