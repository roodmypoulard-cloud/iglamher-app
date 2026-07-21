import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export interface AuditEntry {
  actorId?: string | null;
  action: string; // e.g. "verification.approve", "dispute.refund"
  entity: string; // e.g. "professional", "dispute", "report", "user"
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append an immutable audit record. Every admin / moderation / fraud / financial
 * action MUST call this (business rule). Written with the service-role client so
 * the log is captured regardless of the caller's RLS scope; audit_logs has no
 * client write policy, so records can't be tampered with from the browser.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  if (!isLiveSupabase()) return;
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Never let audit failure block the primary action; surfaced via monitoring.
  }
}
