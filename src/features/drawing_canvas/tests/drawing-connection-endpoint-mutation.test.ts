import { describe, expect, it } from "vitest";
import {
  buildPackageConnectivityGraph,
  buildPackageTerminalOccupancyIndex
} from "@/features/drawing_panel_wiring/api/public";
import { createGenericPanelWiringSource } from "@/features/drawing_panel_wiring/tests/fixtures";
import { validateConnectionEndpointMutation } from "../logic/services/drawing-connection-endpoint-mutation";

describe("drawing connection endpoint mutation", () => {
  const source = createGenericPanelWiringSource();
  const index = buildPackageTerminalOccupancyIndex(
    buildPackageConnectivityGraph(source)
  );
  const connection = {
    id: "connection_1_1",
    from: { placementId: "cable_1", anchorKey: "CH1" },
    to: { placementId: "strip_1", anchorKey: "T1_BOTTOM" }
  };

  it("allows an edited connection to retain its current endpoint", () => {
    expect(
      validateConnectionEndpointMutation({
        index,
        sheetId: "sheet_field_1",
        connection,
        endpointRole: "to",
        candidate: connection.to
      }).ok
    ).toBe(true);
  });

  it("allows moving to the opposite free terminal end", () => {
    expect(
      validateConnectionEndpointMutation({
        index,
        sheetId: "sheet_field_1",
        connection,
        endpointRole: "to",
        candidate: { placementId: "strip_1", anchorKey: "T1_TOP" }
      }).ok
    ).toBe(true);
  });

  it("rejects moving onto another occupied terminal end", () => {
    const result = validateConnectionEndpointMutation({
      index,
      sheetId: "sheet_field_1",
      connection,
      endpointRole: "to",
      candidate: { placementId: "strip_1", anchorKey: "T2_BOTTOM" }
    });
    expect(result.ok).toBe(false);
    expect(result.availability.status).toBe("occupied");
    if (!result.ok) {
      expect(result.error).toContain("Sheet 1");
    }
  });
});
