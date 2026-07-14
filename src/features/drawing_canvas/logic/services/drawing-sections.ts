import type { DrawingModel } from "../../data/schema";

export type DrawingSection = {
  id: string;
  number: number;
  titlePageSheetId: string;
  title: string;
  startIndex: number;
  endIndexExclusive: number;
  memberSheetIds: string[];
};

export type DrawingSectionMembership =
  | { kind: "front_matter" }
  | {
      kind: "section";
      sectionId: string;
      sectionNumber: number;
      isTitlePage: boolean;
    };

export type DrawingSectionIndex = {
  frontMatterSheetIds: string[];
  sections: DrawingSection[];
  membershipBySheetId: Map<string, DrawingSectionMembership>;
};

export function buildDrawingSectionIndex(
  model: DrawingModel
): DrawingSectionIndex {
  const titlePageIndexes = model.sheets.flatMap((sheet, index) =>
    sheet.kind === "section_title" ? [index] : []
  );
  const firstSectionIndex = titlePageIndexes[0] ?? model.sheets.length;
  const frontMatterSheetIds = model.sheets
    .slice(0, firstSectionIndex)
    .map((sheet) => sheet.id);
  const membershipBySheetId = new Map<string, DrawingSectionMembership>();

  for (const sheetId of frontMatterSheetIds) {
    membershipBySheetId.set(sheetId, { kind: "front_matter" });
  }

  const sections = titlePageIndexes.map((startIndex, sectionIndex) => {
    const titlePage = model.sheets[startIndex];
    const endIndexExclusive =
      titlePageIndexes[sectionIndex + 1] ?? model.sheets.length;
    const number = sectionIndex + 1;
    const section: DrawingSection = {
      id: titlePage.id,
      number,
      titlePageSheetId: titlePage.id,
      title:
        titlePage.sectionTitlePage?.title?.trim() ||
        titlePage.name ||
        `Section ${number}`,
      startIndex,
      endIndexExclusive,
      memberSheetIds: model.sheets
        .slice(startIndex + 1, endIndexExclusive)
        .map((sheet) => sheet.id)
    };

    membershipBySheetId.set(titlePage.id, {
      kind: "section",
      sectionId: section.id,
      sectionNumber: number,
      isTitlePage: true
    });
    for (const sheetId of section.memberSheetIds) {
      membershipBySheetId.set(sheetId, {
        kind: "section",
        sectionId: section.id,
        sectionNumber: number,
        isTitlePage: false
      });
    }

    return section;
  });

  return { frontMatterSheetIds, sections, membershipBySheetId };
}

export function getDrawingSectionForSheet(
  index: DrawingSectionIndex,
  sheetId: string
): DrawingSectionMembership | undefined {
  return index.membershipBySheetId.get(sheetId);
}

export function getSectionInsertionIndex(
  model: DrawingModel,
  activeSheetId: string | undefined
): number {
  const index = buildDrawingSectionIndex(model);
  const membership = activeSheetId
    ? index.membershipBySheetId.get(activeSheetId)
    : undefined;

  if (membership?.kind === "section") {
    return (
      index.sections.find((section) => section.id === membership.sectionId)
        ?.endIndexExclusive ?? model.sheets.length
    );
  }

  if (index.sections.length > 0) {
    return index.sections[0].startIndex;
  }

  return model.sheets.length;
}

export function getSheetInsertionIndex(
  model: DrawingModel,
  activeSheetId: string | undefined
): number {
  const activeIndex = model.sheets.findIndex(
    (sheet) => sheet.id === activeSheetId
  );

  return activeIndex >= 0 ? activeIndex + 1 : model.sheets.length;
}

export function getDerivedSectionNumber(
  model: DrawingModel,
  sheetId: string
): number | undefined {
  const membership = buildDrawingSectionIndex(model).membershipBySheetId.get(
    sheetId
  );

  return membership?.kind === "section"
    ? membership.sectionNumber
    : undefined;
}
