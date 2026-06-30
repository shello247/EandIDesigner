import { notFound } from "next/navigation";
import { getSymbolDocumentForDownload } from "@/features/symbol_registry/data/queries";

export const dynamic = "force-dynamic";

function parseDataUrl(dataUrl: string): ArrayBuffer {
  const match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);

  if (!match) {
    throw new Error("Document payload is not a valid data URL.");
  }

  const buffer = Buffer.from(match[1], "base64");
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);

  return arrayBuffer;
}

function encodeFileName(fileName: string): string {
  const fallback = fileName.replace(/["\\\r\n]/g, "_") || "document.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const document = await getSymbolDocumentForDownload(documentId);

  if (!document) {
    notFound();
  }

  return new Response(parseDataUrl(document.dataUrl), {
    headers: {
      "Content-Type": document.mimeType || "application/pdf",
      "Content-Disposition": encodeFileName(document.fileName),
      "Cache-Control": "private, max-age=0, must-revalidate"
    }
  });
}
