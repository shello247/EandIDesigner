export type AuditConfiguration = { root: string; runId: string; database: string; databaseUrl: string; output: string };
export function resolveAuditConfiguration(root?: string, phase?: string): AuditConfiguration;
export function assertAuditDatabase(configuration?: AuditConfiguration, databaseUrl?: string): void;
