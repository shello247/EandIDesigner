import type { DrawingModel } from "../../data/schema";
import {
  buildDrawingSectionIndex,
  type DrawingSection
} from "../services/drawing-sections";

export type DrawingSectionMoveDirection = -1 | 1 | "first" | "last";
export type DrawingSectionTarget = string | "front_matter";

function sectionBlock(model: DrawingModel, section: DrawingSection) {
  return model.sheets.slice(section.startIndex, section.endIndexExclusive);
}

export function moveDrawingSection(
  model: DrawingModel,
  sectionId: string,
  direction: DrawingSectionMoveDirection
): DrawingModel {
  const index = buildDrawingSectionIndex(model);
  const currentSectionIndex = index.sections.findIndex(
    (section) => section.id === sectionId
  );

  if (currentSectionIndex < 0) return model;

  const targetSectionIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? index.sections.length - 1
        : currentSectionIndex + direction;

  if (
    targetSectionIndex < 0 ||
    targetSectionIndex >= index.sections.length ||
    targetSectionIndex === currentSectionIndex
  ) {
    return model;
  }

  const blocks = index.sections.map((section) => sectionBlock(model, section));
  const [movedBlock] = blocks.splice(currentSectionIndex, 1);
  blocks.splice(targetSectionIndex, 0, movedBlock);

  return {
    ...model,
    sheets: [
      ...model.sheets.slice(0, index.frontMatterSheetIds.length),
      ...blocks.flat()
    ]
  };
}

export function moveSheetWithinSection(
  model: DrawingModel,
  sheetId: string,
  direction: -1 | 1
): DrawingModel {
  const index = buildDrawingSectionIndex(model);
  const membership = index.membershipBySheetId.get(sheetId);
  if (!membership || (membership.kind === "section" && membership.isTitlePage)) {
    return model;
  }

  const groupSheetIds =
    membership.kind === "front_matter"
      ? index.frontMatterSheetIds
      : index.sections.find((section) => section.id === membership.sectionId)
          ?.memberSheetIds ?? [];
  const currentGroupIndex = groupSheetIds.indexOf(sheetId);
  const targetSheetId = groupSheetIds[currentGroupIndex + direction];
  if (!targetSheetId) return model;

  const currentIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  const targetIndex = model.sheets.findIndex(
    (sheet) => sheet.id === targetSheetId
  );
  if (currentIndex < 0 || targetIndex < 0) return model;

  const sheets = [...model.sheets];
  [sheets[currentIndex], sheets[targetIndex]] = [
    sheets[targetIndex],
    sheets[currentIndex]
  ];

  return { ...model, sheets };
}

export function moveSheetToSectionEnd(
  model: DrawingModel,
  sheetId: string
): DrawingModel {
  const index = buildDrawingSectionIndex(model);
  const membership = index.membershipBySheetId.get(sheetId);
  if (!membership || (membership.kind === "section" && membership.isTitlePage)) {
    return model;
  }
  const groupSheetIds =
    membership.kind === "front_matter"
      ? index.frontMatterSheetIds
      : index.sections.find((section) => section.id === membership.sectionId)
          ?.memberSheetIds ?? [];
  const lastSheetId = groupSheetIds.at(-1);
  if (!lastSheetId || lastSheetId === sheetId) return model;

  const currentIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  const lastIndex = model.sheets.findIndex((sheet) => sheet.id === lastSheetId);
  const sheets = [...model.sheets];
  const [sheet] = sheets.splice(currentIndex, 1);
  sheets.splice(lastIndex, 0, sheet);

  return { ...model, sheets };
}

export function moveSheetToDrawingSection(
  model: DrawingModel,
  sheetId: string,
  target: DrawingSectionTarget
): DrawingModel {
  const initialIndex = buildDrawingSectionIndex(model);
  const membership = initialIndex.membershipBySheetId.get(sheetId);
  if (!membership || (membership.kind === "section" && membership.isTitlePage)) {
    return model;
  }
  if (
    (target === "front_matter" && membership.kind === "front_matter") ||
    (membership.kind === "section" && membership.sectionId === target)
  ) {
    return model;
  }
  if (
    target !== "front_matter" &&
    !initialIndex.sections.some((section) => section.id === target)
  ) {
    return model;
  }

  const currentIndex = model.sheets.findIndex((sheet) => sheet.id === sheetId);
  if (currentIndex < 0) return model;
  const sheets = [...model.sheets];
  const [sheet] = sheets.splice(currentIndex, 1);
  const reducedModel = { ...model, sheets };
  const reducedIndex = buildDrawingSectionIndex(reducedModel);
  const insertAt =
    target === "front_matter"
      ? reducedIndex.frontMatterSheetIds.length
      : reducedIndex.sections.find((section) => section.id === target)
          ?.endIndexExclusive;

  if (insertAt === undefined) return model;
  sheets.splice(insertAt, 0, sheet);
  return { ...model, sheets };
}

export function removeSectionDivider(
  model: DrawingModel,
  sectionId: string
): DrawingModel {
  const index = buildDrawingSectionIndex(model);
  if (
    model.sheets.length <= 1 ||
    !index.sections.some((section) => section.id === sectionId)
  ) {
    return model;
  }

  return {
    ...model,
    sheets: model.sheets.filter((sheet) => sheet.id !== sectionId)
  };
}
