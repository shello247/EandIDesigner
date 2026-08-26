import type { RouteAlignmentFeedback } from "../../logic/services/connection-route-alignment";

export function RouteAlignmentGuidesOverlay({
  feedback,
  screenScale
}: {
  feedback: RouteAlignmentFeedback[];
  screenScale: number;
}) {
  if (feedback.length === 0) {
    return null;
  }

  return (
    <g
      data-testid="canvas-route-alignment-guides"
      className="pointer-events-none"
      aria-hidden="true"
    >
      {feedback.map((guide) => (
        <line
          key={`${guide.axis}:${guide.sourceKind}:${guide.sourceId}`}
          data-testid="canvas-route-alignment-guide"
          data-alignment-axis={guide.axis}
          x1={guide.guideStart.x}
          y1={guide.guideStart.y}
          x2={guide.guideEnd.x}
          y2={guide.guideEnd.y}
          className="stroke-cyan-500"
          strokeWidth={1 / screenScale}
          strokeDasharray={`${5 / screenScale} ${4 / screenScale}`}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
