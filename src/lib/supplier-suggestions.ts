import type { SupabaseClient } from "@supabase/supabase-js"

export interface SupplierSuggestions {
  truck_plate: string | null
  driver_name: string | null
  avg_volume_mdc: number | null
  last_volume_mdc: number | null
}

export async function getSupplierSuggestions(
  supabase: SupabaseClient,
  supplierId: string
): Promise<SupplierSuggestions> {
  // Query 1: Últimas 5 descargas
  const { data: discharges } = await supabase
    .from("discharges")
    .select("truck_plate, volume_mdc")
    .eq("supplier_id", supplierId)
    .order("discharge_date", { ascending: false })
    .limit(5)

  // Query 2: Últimos 3 agendamentos (para placa/motorista)
  const { data: queueEntries } = await supabase
    .from("queue_entries")
    .select("truck_plate, driver_name, estimated_volume_mdc")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false })
    .limit(3)

  // Placa mais frequente (descargas + agendamentos)
  const allPlates = [
    ...(discharges || []).map((d) => d.truck_plate),
    ...(queueEntries || []).map((q) => q.truck_plate),
  ].filter(Boolean) as string[]

  const plateFreq = allPlates.reduce<Record<string, number>>((acc, p) => {
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})
  const topPlate =
    Object.entries(plateFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Motorista mais recente associado à placa mais frequente
  const driverForPlate =
    queueEntries?.find((q) => q.truck_plate === topPlate)?.driver_name ||
    queueEntries?.[0]?.driver_name ||
    null

  // Volume médio
  const volumes = (discharges || [])
    .map((d) => d.volume_mdc)
    .filter(Boolean) as number[]
  const avgVolume =
    volumes.length > 0
      ? Math.round(
          (volumes.reduce((s, v) => s + v, 0) / volumes.length) * 100
        ) / 100
      : null

  return {
    truck_plate: topPlate,
    driver_name: driverForPlate,
    avg_volume_mdc: avgVolume,
    last_volume_mdc: discharges?.[0]?.volume_mdc || null,
  }
}
