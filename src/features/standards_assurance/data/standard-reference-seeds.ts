import type { ContentByKind } from "./schema";
const sources = [
  ["iec-60617", "IEC", "IEC 60617", "2026 DB", "", "Graphical symbols for diagrams", "https://webstore.iec.ch/en/publication/2723"],
  ["iec-61082-1", "IEC", "IEC 61082-1", "2014", "", "Preparation of documents used in electrotechnology — Rules", "https://webstore.iec.ch/en/publication/4469"],
  ["iec-81346-1", "IEC", "IEC 81346-1", "2022", "", "Structuring principles and reference designations — Basic rules", "https://webstore.iec.ch/en/publication/64021"],
  ["iec-81346-2", "IEC / ISO", "IEC 81346-2", "2019", "", "Classification of objects and codes for classes", "https://www.iso.org/standard/75265.html"],
  ["iec-61666", "IEC", "IEC 61666", "2010", "AMD1:2021", "Identification of terminals within a system", "https://webstore.iec.ch/en/publication/69168"]
];
export const referenceSeeds = sources.map(([key, publisher, designation, edition, amendment, title, sourceUrl]) => ({
  key, content: { publisher, designation, edition, amendment, title, sourceUrl, kind: "international_standard",
    subject: title, access: "catalogue_only", materialExamined: "",
    rightsNotes: "Bibliographic reference only. Obtain authorized access before interpreting clauses or reproducing source material.", status: "active" } satisfies ContentByKind["reference"]
}));
export const candidateSeeds = [
  ["symbol-selection", "iec-60617", "Symbol Selection and Identification", "Select a reviewed representation for the intended electrical function.", "A reviewed symbol mapping must preserve equipment and terminal identities."],
  ["terminal-identification", "iec-61666", "Terminal Identification", "Identify terminals consistently across representations.", "Keep canonical terminal references and present reviewed terminal designations."],
  ["reference-designations", "iec-81346-1", "Equipment Reference Designations", "Define a consistent equipment identification policy.", "Keep equipment identity consistent across drawings, schedules and views."],
  ["connections", "iec-61082-1", "Connection and Junction Presentation", "Review how connections, junctions and crossings are presented.", "Show intended connectivity without ambiguous junctions."],
  ["cross-references", "iec-61082-1", "Cross-References", "Review navigation between related representations and sheets.", "Provide unambiguous references to related equipment and drawing content."],
  ["presentation-export", "iec-61082-1", "Drawing Presentation and Export Readability", "Review the presentation and readability of drawings and exported documents.", "Retain identifiers, clear connections and readable content in exports."]
].map(([key, sourceKey, title, explanation, expectedBehavior]) => ({
  key, sourceKey, content: { title, explanation, expectedBehavior, locator: "", sourceStatus: "candidate",
    interpretation: "Candidate research topic; no normative clause interpretation has been verified.",
    applicability: "Electrical documentation scope; detailed applicability requires authoritative source review.",
    exclusions: "", owner: "", verificationMethod: "combined", status: "active" } as Omit<ContentByKind["requirement"], "sourceRevisionId">
}));

