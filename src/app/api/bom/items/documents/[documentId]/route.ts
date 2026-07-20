import { getBomItemDocumentPayload } from "@/features/bom_creator/api/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DOCUMENT_CACHE_CONTROL = "private, max-age=31536000, immutable";

function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  return Boolean(
    ifNoneMatch
      ?.split(",")
      .map((candidate) => candidate.trim())
      .some((candidate) => candidate === "*" || candidate === etag)
  );
}

function contentDisposition(fileName: string): string {
  const asciiName = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  try {
    const payload = await getBomItemDocumentPayload(documentId);

    if (!payload) {
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" }
      });
    }

    const sharedHeaders = {
      "Cache-Control": DOCUMENT_CACHE_CONTROL,
      ETag: payload.etag,
      "X-Content-Type-Options": "nosniff"
    };

    if (matchesEtag(request.headers.get("if-none-match"), payload.etag)) {
      return new Response(null, { status: 304, headers: sharedHeaders });
    }

    return new Response(payload.bytes, {
      headers: {
        ...sharedHeaders,
        "Content-Type": payload.mimeType,
        "Content-Length": String(payload.contentLength),
        "Content-Disposition": contentDisposition(payload.fileName)
      }
    });
  } catch (error) {
    console.error("Unable to serve BOM item document.", error);
    return new Response(null, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
