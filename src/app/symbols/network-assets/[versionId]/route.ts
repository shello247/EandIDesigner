import { notFound } from "next/navigation";
import { getApprovedNetworkSymbolSvgAsset } from "@/features/symbol_registry/api/public";

export const dynamic = "force-dynamic";

function assetHeaders(versionId: string): HeadersInit {
  const safeVersionId = versionId.replace(/[^A-Za-z0-9._-]/g, "_");

  return {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Disposition": `inline; filename="network-symbol-${safeVersionId}.svg"`,
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: `"${safeVersionId}"`,
    "X-Content-Type-Options": "nosniff"
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await params;
  const asset = await getApprovedNetworkSymbolSvgAsset(versionId);

  if (!asset) {
    notFound();
  }

  const headers = new Headers(assetHeaders(asset.versionId));
  if (request.headers.get("if-none-match") === headers.get("ETag")) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(asset.svg, { headers });
}
