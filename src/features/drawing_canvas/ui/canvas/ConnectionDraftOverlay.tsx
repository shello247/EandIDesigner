import type { GuidedConnectionPreviewResult } from "../../logic/services/guided-connection-routing";
import { routeToPathData } from "../../logic/services/connection-route-renderer";
import { RouteAlignmentGuidesOverlay } from "./RouteAlignmentGuidesOverlay";

function pathData(points: Array<{ x: number; y: number }>): string {
  return routeToPathData({
    mode: "manual",
    style: "orthogonal",
    points: points.map((point, index) => ({
      id: `draft_preview_${index}`,
      kind: index === 0 || index === points.length - 1 ? "endpoint" : "control",
      x: point.x,
      y: point.y
    }))
  });
}

export function ConnectionDraftOverlay({
  preview,
  fixedPoints,
  screenScale
}: {
  preview: GuidedConnectionPreviewResult;
  fixedPoints: Array<{ x: number; y: number }>;
  screenScale: number;
}) {
  if (preview.points.length < 2 && fixedPoints.length < 2) return null;

  const strokeWidth = 1.15 / screenScale;
  const waypointSize = 5.5 / screenScale;

  return (
    <g
      data-testid="canvas-guided-connection-preview"
      className="pointer-events-none"
      role="status"
      aria-label="Guided orthogonal connection preview"
    >
      <title>
        Click to add a bend. Backspace removes the latest bend. Select a
        terminal to finish. Escape cancels.
      </title>
      {preview.points.length >= 2 ? (
        <path
          data-testid="canvas-connection-preview"
          d={pathData(preview.points)}
          fill="none"
          className="stroke-sky-500"
          strokeWidth={strokeWidth}
          strokeDasharray={`${5 / screenScale} ${3 / screenScale}`}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {fixedPoints.length >= 2 ? (
        <path
          data-testid="canvas-guided-connection-fixed-path"
          d={pathData(fixedPoints)}
          fill="none"
          className="stroke-sky-600"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {preview.waypoints.map((waypoint, index) => (
        <rect
          key={waypoint.id}
          data-testid="canvas-guided-connection-waypoint"
          data-waypoint-index={index}
          x={waypoint.x - waypointSize / 2}
          y={waypoint.y - waypointSize / 2}
          width={waypointSize}
          height={waypointSize}
          rx={0.8 / screenScale}
          className="fill-white stroke-sky-600"
          strokeWidth={1 / screenScale}
        />
      ))}
      <RouteAlignmentGuidesOverlay
        feedback={preview.alignmentFeedback}
        screenScale={screenScale}
      />
    </g>
  );
}
