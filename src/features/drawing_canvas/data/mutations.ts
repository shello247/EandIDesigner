import { prisma } from "@/lib/prisma";
import { listApprovedSymbolsForDrawing } from "@/features/symbol_registry/api/public";
import {
  createDefaultDrawingModel,
  createDrawingInputSchema,
  saveDrawingInputSchema,
  stringifyDrawingModel,
  type CreateDrawingInput,
  type DrawingModel,
  type SaveDrawingInput
} from "./schema";
import { getDrawingDetail } from "./queries";

function normalizeDrawingKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "drawing";
}

async function nextUniqueDrawingKey(baseValue: string): Promise<string> {
  const baseKey = normalizeDrawingKey(baseValue);
  let candidate = baseKey;
  let suffix = 2;

  while (
    await prisma.drawing.findUnique({
      where: { drawingKey: candidate },
      select: { id: true }
    })
  ) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createDrawing(input: CreateDrawingInput) {
  const parsed = createDrawingInputSchema.parse(input);
  const drawingKey = await nextUniqueDrawingKey(
    parsed.drawingKey ?? parsed.title
  );
  const model = createDefaultDrawingModel();

  const row = await prisma.drawing.create({
    data: {
      drawingKey,
      title: parsed.title,
      status: "draft",
      modelJson: stringifyDrawingModel(model)
    }
  });

  return getDrawingDetail(row.id);
}

export async function saveDrawing(input: SaveDrawingInput) {
  const parsed = saveDrawingInputSchema.parse(input);

  await prisma.drawing.update({
    where: { id: parsed.drawingId },
    data: {
      title: parsed.title,
      status: "needs_review",
      modelJson: stringifyDrawingModel(parsed.model)
    }
  });

  return getDrawingDetail(parsed.drawingId);
}

export async function approveDrawing(drawingId: string) {
  await prisma.drawing.update({
    where: { id: drawingId },
    data: { status: "approved" }
  });

  return getDrawingDetail(drawingId);
}

export async function deleteDrawing(drawingId: string) {
  await prisma.drawing.delete({
    where: { id: drawingId }
  });
}

function placementId(value: string): string {
  return value.replace(/[^a-z0-9_]+/gi, "_").toLowerCase();
}

function requireSymbol(
  symbols: Awaited<ReturnType<typeof listApprovedSymbolsForDrawing>>,
  symbolKey: string
) {
  const symbol = symbols.find((candidate) => candidate.symbolKey === symbolKey);

  if (!symbol) {
    throw new Error(`Approved symbol "${symbolKey}" was not found.`);
  }

  return symbol;
}

export async function createNmt81ToNrf81SampleDrawing() {
  const approvedSymbols = await listApprovedSymbolsForDrawing();
  const nmt81 = requireSymbol(approvedSymbols, "nmt81_average_temperature_probe");
  const nrf81 = requireSymbol(approvedSymbols, "nrf81_tank_side_monitor");
  const cable = requireSymbol(approvedSymbols, "clx_cable_1_pair");
  const model: DrawingModel = {
    ...createDefaultDrawingModel(),
    sheet: {
      ...createDefaultDrawingModel().sheet,
      titleBlock: {
        client: "Enermech",
        project: "Wenika Tank Automation Project",
        drawingNumber: "EI-NMT81-NRF81-001",
        revision: "A",
        preparedBy: "EI Designer",
        date: new Date().toISOString().slice(0, 10)
      }
    },
    placements: [
      {
        id: placementId("NMT81"),
        symbolId: nmt81.symbolId,
        versionId: nmt81.versionId,
        role: "device",
        tag: "TT-101",
        x: 24,
        y: 36,
        rotation: 0,
        scale: 0.34
      },
      {
        id: placementId("CLX1P"),
        symbolId: cable.symbolId,
        versionId: cable.versionId,
        role: "cable_assembly",
        tag: "C-101",
        x: 110,
        y: 62,
        rotation: 0,
        scale: 0.52
      },
      {
        id: placementId("NRF81"),
        symbolId: nrf81.symbolId,
        versionId: nrf81.versionId,
        role: "device",
        tag: "TSM-101",
        x: 280,
        y: 70,
        rotation: 0,
        scale: 0.38
      }
    ],
    connections: [
      {
        id: "conn_nmt81_1_to_cable_1",
        from: { placementId: placementId("NMT81"), anchorKey: "1" },
        to: { placementId: placementId("CLX1P"), anchorKey: "CH1_T1" },
        label: "White",
        wireId: "C-101-WHT",
        cablePlacementId: placementId("CLX1P"),
        conductorKey: "CH1_T1"
      },
      {
        id: "conn_nmt81_2_to_cable_2",
        from: { placementId: placementId("NMT81"), anchorKey: "2" },
        to: { placementId: placementId("CLX1P"), anchorKey: "CH1_T2" },
        label: "Black",
        wireId: "C-101-BLK",
        cablePlacementId: placementId("CLX1P"),
        conductorKey: "CH1_T2"
      },
      {
        id: "conn_cable_1_to_nrf81_e1",
        from: { placementId: placementId("CLX1P"), anchorKey: "CH2_T1" },
        to: { placementId: placementId("NRF81"), anchorKey: "E1" },
        label: "White",
        wireId: "C-101-WHT",
        cablePlacementId: placementId("CLX1P"),
        conductorKey: "CH2_T1"
      },
      {
        id: "conn_cable_2_to_nrf81_e2",
        from: { placementId: placementId("CLX1P"), anchorKey: "CH2_T2" },
        to: { placementId: placementId("NRF81"), anchorKey: "E2" },
        label: "Black",
        wireId: "C-101-BLK",
        cablePlacementId: placementId("CLX1P"),
        conductorKey: "CH2_T2"
      }
    ],
    annotations: [
      {
        id: "note_title",
        text: "NMT81 Prothermo to NRF81 Tank Side Monitor Wiring",
        x: 126,
        y: 24,
        kind: "title"
      }
    ]
  };

  const row = await prisma.drawing.create({
    data: {
      drawingKey: await nextUniqueDrawingKey("nmt81_to_nrf81_wiring"),
      title: "NMT81 to NRF81 Wiring",
      status: "needs_review",
      modelJson: stringifyDrawingModel(model)
    }
  });

  return getDrawingDetail(row.id);
}
