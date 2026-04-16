/**
 * archiver.service.ts
 *
 * Capa de datos del Ciclo de Vida de Prospectos.
 * NUNCA llama a Supabase directamente — todo pasa por API Routes.
 *
 * Flujo:
 *   Componente/Admin → archiver.service → POST /api/kanban/archivar
 *     → Zod valida → auth.getUser() → supabase.rpc('archivar_prospectos')
 *       → Transacción PG atómica:
 *           INSERT prospectos_historico (snapshot completo)
 *           Count-check de integridad
 *           INSERT audit_logs (uno por prospecto)
 *           DELETE prospectos
 *         → ROLLBACK automático si algo falla
 *
 * Garantía RLS: el servidor toma tenant_id y socio_id del JWT —
 * el cliente NUNCA puede suplantar ni filtrar por otro tenant.
 */

import type {
  ArchiverCriteria,
  ArchiverResult,
  ArchiverServiceResult,
} from '../types/archiver.types'

// ─────────────────────────────────────────────────────────────
// archiveProspects
//
// Parámetros:
//   criteria  — criterio de archivo (batch_inactividad | comportamental)
//
// El tenant_id lo toma el servidor del JWT — no se envía desde el cliente.
// El actor_id (socio) lo toma el servidor de auth.getUser() — no suplantable.
//
// Retorna el resultado de la función PG archivar_prospectos():
//   { archivados, lote_id, ids }
// ─────────────────────────────────────────────────────────────
export async function archiveProspects(
  criteria: ArchiverCriteria
): Promise<ArchiverServiceResult> {
  try {
    const res = await fetch('/api/kanban/archivar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // credentials: 'include' garantiza que la cookie de sesión viaja
      // con el request — el servidor puede leer el JWT del socio.
      credentials: 'include',
      body: JSON.stringify(criteria),
    })

    if (res.status === 401) {
      return { data: null, error: 'Sesión expirada. Por favor inicia sesión nuevamente.' }
    }

    if (!res.ok) {
      const body = await res.json()
      return { data: null, error: body.error ?? 'Error al archivar prospectos.' }
    }

    const json = await res.json()
    const result: ArchiverResult = {
      archivados: json.archivados ?? 0,
      lote_id: json.lote_id ?? '',
      ids: Array.isArray(json.ids) ? json.ids : [],
    }

    return { data: result, error: null }
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor.' }
  }
}

// ─────────────────────────────────────────────────────────────
// archiveInactivos
//
// Atajo para Batch Cleanup estándar (60 o 90 días sin actividad).
// Restringe automáticamente a las columnas de riesgo:
//   sin_respuesta | no_interesado | reagendar
// ─────────────────────────────────────────────────────────────
export async function archiveInactivos(
  dias: 60 | 90
): Promise<ArchiverServiceResult> {
  return archiveProspects({
    type: 'batch_inactividad',
    dias,
    columnas: ['sin_respuesta', 'no_interesado', 'reagendar'],
    motivo: `Inactividad mayor a ${dias} días en columnas de riesgo`,
  })
}

// ─────────────────────────────────────────────────────────────
// archiveClientesSilenciosos
//
// Atajo para Behavioral Cleanup:
// Clientes con historial de compras que llevan mucho tiempo sin responder.
// Caso MLM: cliente con ≥1 ciclo completo que ya no responde.
// ─────────────────────────────────────────────────────────────
export async function archiveClientesSilenciosos(
  minPedidos: number = 1,
  diasSinRespuesta: number = 90
): Promise<ArchiverServiceResult> {
  return archiveProspects({
    type: 'comportamental',
    min_pedidos: minPedidos,
    dias_sin_respuesta: diasSinRespuesta,
    motivo: `Cliente con ${minPedidos}+ pedidos sin respuesta por ${diasSinRespuesta} días`,
  })
}
