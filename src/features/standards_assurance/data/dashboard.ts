import { prisma } from "@/lib/prisma";
export async function getDashboard() {
  const [sources, requirements, implementations, profiles, evidence, reviews] = await Promise.all([
    prisma.standardReference.count({ where: { status: "active" } }), prisma.standardRequirement.count({ where: { status: "active" } }),
    prisma.standardImplementation.count({ where: { status: "active" } }), prisma.standardProfile.count({ where: { status: "active" } }),
    prisma.standardEvidence.count(), prisma.standardReviewNote.count()
  ]);
  return { sources, requirements, implementations, profiles, evidence, reviews };
}

