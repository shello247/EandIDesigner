import { getSnapshot, snapshotHtml, snapshotJson } from "@/features/standards_assurance/api/public";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string; format: string }> }) {
  const { snapshotId, format } = await params;
  if (!/^[a-zA-Z0-9-]{1,140}$/.test(snapshotId) || !["html", "json"].includes(format)) return new Response("Not found", { status: 404 });
  try {
    const snapshot = await getSnapshot(snapshotId);
    return new Response(format === "html" ? snapshotHtml(snapshot) : snapshotJson(snapshot), { headers: {
      "Content-Type": format === "html" ? "text/html; charset=utf-8" : "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      ...(format === "json" ? { "Content-Disposition": `attachment; filename="standards-${snapshotId}.json"` } : {})
    } });
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "not_found";
    return new Response(missing ? "Report snapshot not found" : "Report unavailable. Its content could not be verified.", { status: missing ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
