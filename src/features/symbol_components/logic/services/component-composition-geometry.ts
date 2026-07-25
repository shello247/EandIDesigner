import type { SymbolMetadata } from "@/features/symbol_registry/api/public";
import {
  SVG_IDENTITY_MATRIX,
  applySvgMatrix,
  multiplySvgMatrices,
  type SvgAffineMatrix
} from "@/shared/svg/figma-svg-structure";
import {
  SYMBOL_COMPONENT_MAX_DEPTH,
  type DrawingComponentSelection,
  type SymbolComponentBox
} from "../../data/schema";
import type { ComponentSelectableSymbol } from "./component-selection-resolver";

export type ComponentCompositionPlacement = {
  path: string[];
  depth: number;
  selection: DrawingComponentSelection;
  symbol: ComponentSelectableSymbol;
  centerX: number;
  centerY: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
};

export type ComponentCompositionResult = {
  placements: ComponentCompositionPlacement[];
  warnings: string[];
};

export type ComponentRootPlacement = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  layoutDimensions?: {
    lengthMm: number;
    widthMm: number;
  };
};

export type ComponentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function translation(x: number, y: number): SvgAffineMatrix {
  return { ...SVG_IDENTITY_MATRIX, e: x, f: y };
}

function rotation(degrees: number): SvgAffineMatrix {
  const radians = (degrees * Math.PI) / 180;
  return {
    a: Math.cos(radians),
    b: Math.sin(radians),
    c: -Math.sin(radians),
    d: Math.cos(radians),
    e: 0,
    f: 0
  };
}

function scale(x: number, y: number): SvgAffineMatrix {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

function multiplyAll(matrices: SvgAffineMatrix[]): SvgAffineMatrix {
  return matrices.reduce(multiplySvgMatrices, SVG_IDENTITY_MATRIX);
}

function rootSymbolMatrix(
  placement: ComponentRootPlacement,
  metadata: SymbolMetadata
): SvgAffineMatrix {
  const scaleX = placement.layoutDimensions
    ? placement.layoutDimensions.lengthMm / metadata.viewBox.width
    : placement.scale;
  const scaleY = placement.layoutDimensions
    ? placement.layoutDimensions.widthMm / metadata.viewBox.height
    : placement.scale;
  const width = metadata.viewBox.width * scaleX;
  const height = metadata.viewBox.height * scaleY;

  return multiplyAll([
    translation(placement.x, placement.y),
    translation(width / 2, height / 2),
    rotation(placement.rotation),
    translation(-width / 2, -height / 2),
    scale(scaleX, scaleY),
    translation(-metadata.viewBox.x, -metadata.viewBox.y)
  ]);
}

function childMeetMatrix(params: {
  centerX: number;
  centerY: number;
  rotationDeg: number;
  widthMm: number;
  heightMm: number;
  metadata: SymbolMetadata;
}): SvgAffineMatrix {
  const scaleValue = Math.min(
    params.widthMm / params.metadata.viewBox.width,
    params.heightMm / params.metadata.viewBox.height
  );
  const contentWidth = params.metadata.viewBox.width * scaleValue;
  const contentHeight = params.metadata.viewBox.height * scaleValue;
  const offsetX = (params.widthMm - contentWidth) / 2;
  const offsetY = (params.heightMm - contentHeight) / 2;

  return multiplyAll([
    translation(params.centerX, params.centerY),
    rotation(params.rotationDeg),
    translation(-params.widthMm / 2, -params.heightMm / 2),
    translation(offsetX, offsetY),
    scale(scaleValue, scaleValue),
    translation(-params.metadata.viewBox.x, -params.metadata.viewBox.y)
  ]);
}

function transformedBoxRotation(
  matrix: SvgAffineMatrix,
  box: SymbolComponentBox
): number {
  const radians = (box.rotationDeg * Math.PI) / 180;
  const x = matrix.a * Math.cos(radians) + matrix.c * Math.sin(radians);
  const y = matrix.b * Math.cos(radians) + matrix.d * Math.sin(radians);
  return Number(((Math.atan2(y, x) * 180) / Math.PI).toFixed(2));
}

export function composeSelectedComponents(params: {
  parentPlacement: ComponentRootPlacement;
  parentSymbol: ComponentSelectableSymbol;
  selections: DrawingComponentSelection[] | undefined;
  symbols: ComponentSelectableSymbol[];
}): ComponentCompositionResult {
  const exactVersions = new Map(
    params.symbols.map((symbol) => [
      `${symbol.symbolId}:${symbol.versionId}`,
      symbol
    ])
  );
  const placements: ComponentCompositionPlacement[] = [];
  const warnings: string[] = [];
  const physicalScale =
    params.parentPlacement.layoutDimensions &&
    params.parentSymbol.metadata.physicalWidthMm &&
    params.parentSymbol.metadata.physicalHeightMm
      ? Math.min(
          params.parentPlacement.layoutDimensions.lengthMm /
            params.parentSymbol.metadata.physicalWidthMm,
          params.parentPlacement.layoutDimensions.widthMm /
            params.parentSymbol.metadata.physicalHeightMm
        )
      : 1;

  const visit = (
    parent: ComponentSelectableSymbol,
    parentMatrix: SvgAffineMatrix,
    selections: DrawingComponentSelection[] | undefined,
    ancestry: string[],
    path: string[],
    depth: number
  ) => {
    if (depth > SYMBOL_COMPONENT_MAX_DEPTH) {
      warnings.push(
        `Component composition exceeded ${SYMBOL_COMPONENT_MAX_DEPTH} levels at ${path.join(" / ")}.`
      );
      return;
    }

    const positions = new Map(
      (parent.metadata.componentPositions ?? []).map((position) => [
        position.key,
        position
      ])
    );

    for (const selection of selections ?? []) {
      const position = positions.get(selection.positionKey);
      const component = position?.components.find(
        (candidate) => candidate.key === selection.componentKey
      );
      const child = exactVersions.get(
        `${selection.symbolId}:${selection.versionId}`
      );
      const componentPath = [
        ...path,
        position?.label ?? selection.positionKey
      ];

      if (!position || !component) {
        warnings.push(
          `Component definition is missing at ${componentPath.join(" / ")}.`
        );
        continue;
      }
      if (!child) {
        warnings.push(
          `Pinned component version ${selection.versionId} is missing at ${componentPath.join(" / ")}.`
        );
        continue;
      }
      if (
        typeof child.metadata.physicalWidthMm !== "number" ||
        typeof child.metadata.physicalHeightMm !== "number"
      ) {
        warnings.push(
          `Component ${child.displayName} has no physical dimensions at ${componentPath.join(" / ")}.`
        );
        continue;
      }
      if (ancestry.includes(child.symbolId)) {
        warnings.push(
          `Component cycle was stopped at ${componentPath.join(" / ")}.`
        );
        continue;
      }

      const center = applySvgMatrix(
        { x: component.box.centerX, y: component.box.centerY },
        parentMatrix
      );
      const rotationDeg = transformedBoxRotation(parentMatrix, component.box);
      const placement: ComponentCompositionPlacement = {
        path: componentPath,
        depth,
        selection,
        symbol: child,
        centerX: Number(center.x.toFixed(2)),
        centerY: Number(center.y.toFixed(2)),
        widthMm: child.metadata.physicalWidthMm * physicalScale,
        heightMm: child.metadata.physicalHeightMm * physicalScale,
        rotationDeg
      };
      placements.push(placement);

      visit(
        child,
        childMeetMatrix({
          centerX: placement.centerX,
          centerY: placement.centerY,
          rotationDeg,
          widthMm: placement.widthMm,
          heightMm: placement.heightMm,
          metadata: child.metadata
        }),
        selection.children,
        [...ancestry, child.symbolId],
        componentPath,
        depth + 1
      );
    }
  };

  visit(
    params.parentSymbol,
    rootSymbolMatrix(params.parentPlacement, params.parentSymbol.metadata),
    params.selections,
    [params.parentSymbol.symbolId],
    [],
    1
  );

  return { placements, warnings };
}

function rotatedRectangleBounds(params: {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDeg: number;
}): ComponentBounds {
  const radians = (params.rotationDeg * Math.PI) / 180;
  const halfWidth =
    (Math.abs(Math.cos(radians)) * params.width +
      Math.abs(Math.sin(radians)) * params.height) /
    2;
  const halfHeight =
    (Math.abs(Math.sin(radians)) * params.width +
      Math.abs(Math.cos(radians)) * params.height) /
    2;

  return {
    x: params.centerX - halfWidth,
    y: params.centerY - halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2
  };
}

export function getComponentCompositionBounds(params: {
  parentPlacement: ComponentRootPlacement;
  parentSymbol: ComponentSelectableSymbol;
  selections: DrawingComponentSelection[] | undefined;
  symbols: ComponentSelectableSymbol[];
}): ComponentBounds {
  const parentWidth = params.parentPlacement.layoutDimensions
    ? params.parentPlacement.layoutDimensions.lengthMm
    : params.parentSymbol.metadata.viewBox.width * params.parentPlacement.scale;
  const parentHeight = params.parentPlacement.layoutDimensions
    ? params.parentPlacement.layoutDimensions.widthMm
    : params.parentSymbol.metadata.viewBox.height * params.parentPlacement.scale;
  const parentBounds = rotatedRectangleBounds({
    centerX: params.parentPlacement.x + parentWidth / 2,
    centerY: params.parentPlacement.y + parentHeight / 2,
    width: parentWidth,
    height: parentHeight,
    rotationDeg: params.parentPlacement.rotation
  });
  const composition = composeSelectedComponents(params);
  const bounds = [
    parentBounds,
    ...composition.placements.map((placement) =>
      rotatedRectangleBounds({
        centerX: placement.centerX,
        centerY: placement.centerY,
        width: placement.widthMm,
        height: placement.heightMm,
        rotationDeg: placement.rotationDeg
      })
    )
  ];
  const minX = Math.min(...bounds.map((bound) => bound.x));
  const minY = Math.min(...bounds.map((bound) => bound.y));
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    x: Number(minX.toFixed(2)),
    y: Number(minY.toFixed(2)),
    width: Number((maxX - minX).toFixed(2)),
    height: Number((maxY - minY).toFixed(2))
  };
}
