import { readClassificationAudit } from "@/features/device_classification/api/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await readClassificationAudit(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "The audit census could not be read. No records were changed. Retry or inspect the application log." }, { status: 500 }); }
}
