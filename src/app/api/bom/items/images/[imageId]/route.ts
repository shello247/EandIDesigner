import { getBomItemImagePayload } from "@/features/bom_creator/api/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_CACHE_CONTROL = "private, max-age=31536000, immutable";

function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === "*" || candidate === etag);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await params;

  try {
    const payload = await getBomItemImagePayload(imageId);

    if (!payload) {
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "private, no-store" }
      });
    }

    const sharedHeaders = {
      "Cache-Control": IMAGE_CACHE_CONTROL,
      ETag: payload.etag,
      "X-Content-Type-Options": "nosniff"
    };

    if (matchesEtag(request.headers.get("if-none-match"), payload.etag)) {
      return new Response(null, {
        status: 304,
        headers: sharedHeaders
      });
    }

    return new Response(payload.bytes, {
      headers: {
        ...sharedHeaders,
        "Content-Type": payload.mimeType,
        "Content-Length": String(payload.contentLength)
      }
    });
  } catch (error) {
    console.error("Unable to serve BOM item image.", error);
    return new Response(null, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" }
    });
  }
}
