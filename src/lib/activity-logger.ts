import type { SupabaseClient } from "@supabase/supabase-js"

export type ActivityEventType =
  | "interaction_registered"
  | "discharge_registered"
  | "discharge_deleted"
  | "load_scheduled"
  | "load_cancelled"
  | "load_postponed"
  | "supplier_created"

interface LogActivityParams {
  supabase: SupabaseClient
  eventType: ActivityEventType
  userId?: string
  userName?: string
  supplierId?: string
  interactionId?: string
  dischargeId?: string
  queueEntryId?: string
  title: string
  subtitle?: string
  metadata?: Record<string, unknown>
}

/**
 * Registra evento no activity_log.
 * Fire-and-forget — erros são logados no console mas não bloqueiam o fluxo.
 */
export function logActivity(params: LogActivityParams) {
  const {
    supabase, eventType, userId, userName, supplierId,
    interactionId, dischargeId, queueEntryId,
    title, subtitle, metadata,
  } = params

  supabase.from("activity_log").insert({
    event_type: eventType,
    user_id: userId || null,
    user_name: userName || null,
    supplier_id: supplierId || null,
    interaction_id: interactionId || null,
    discharge_id: dischargeId || null,
    queue_entry_id: queueEntryId || null,
    title,
    subtitle: subtitle || null,
    metadata: metadata || {},
  }).then(({ error }) => {
    if (error) console.error("[activity-logger]", error.message)
  })
}
