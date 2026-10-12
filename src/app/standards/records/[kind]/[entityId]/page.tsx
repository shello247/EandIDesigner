import { notFound } from "next/navigation";
import { entityKindSchema } from "@/features/standards_assurance/data/schema";
import { StandardsRecord } from "@/features/standards_assurance/ui/components/standards-record";
export default async function RecordPage({ params, searchParams }: { params: Promise<{ kind: string; entityId: string }>; searchParams: Promise<{ revision?: string }> }) {
  const { kind, entityId } = await params;
  const parsed = entityKindSchema.safeParse(kind);
  if (!parsed.success) notFound();
  const { revision } = await searchParams;
  return <StandardsRecord kind={parsed.data} entityId={entityId} initialRevisionId={revision}/>;
}
