/**
 * archiver.types.ts
 *
 * Tipos del sistema de Ciclo de Vida de Prospectos.
 * Dos criterios de archivo: batch por inactividad, y comportamental por compras.
 */

import type { ColumnaKanban } from './kanban.types'

// ─── Criterios de archivo ────────────────────────────────────────────────────

/**
 * Batch Cleanup — archiva prospectos cuyo actualizado_en
 * supera el umbral de días y, opcionalmente, están en columnas específicas.
 *
 * Caso de uso: limpiar el Kanban de contactos que llevan 60/90 días sin actividad.
 */
export interface CriterioBatchInactividad {
  type: 'batch_inactividad'
  /** Umbral de inactividad: 60 o 90 días desde actualizado_en */
  dias: 60 | 90
  /**
   * Columnas del Kanban donde aplica el archivo.
   * Si se omite, aplica a TODAS las columnas.
   * Recomendado: ['sin_respuesta', 'no_interesado', 'reagendar']
   */
  columnas?: ColumnaKanban[]
  /** Texto que queda en motivo_archivado y en audit_logs.razon */
  motivo: string
}

/**
 * Behavioral Cleanup — archiva prospectos/clientes activos que tienen
 * N o más pedidos pero llevan X días sin responder.
 *
 * Caso de uso: ciclos de recompra MLM — clientes con historial que dejaron
 * de responder después de sus compras.
 */
export interface CriterioComportamental {
  type: 'comportamental'
  /** Mínimo de pedidos que debe tener el prospecto para ser candidato */
  min_pedidos: number
  /** Días de silencio (dias_sin_contacto >= este valor) */
  dias_sin_respuesta: number
  /** Texto que queda en motivo_archivado y en audit_logs.razon */
  motivo: string
}

export type ArchiverCriteria = CriterioBatchInactividad | CriterioComportamental

// ─── Resultado de la función PG archivar_prospectos() ───────────────────────

export interface ArchiverResult {
  /** Cantidad de prospectos efectivamente archivados */
  archivados: number
  /**
   * UUID único del lote. Agrupa todos los registros archivados
   * en esta ejecución dentro de prospectos_historico.
   */
  lote_id: string
  /** UUIDs de los prospectos archivados */
  ids: string[]
}

// ─── Resultado de la capa de servicio ───────────────────────────────────────

export interface ArchiverServiceResult {
  data: ArchiverResult | null
  error: string | null
}

// ─── Parámetros del RPC PostgreSQL (uso interno del API Route) ───────────────

export interface RpcArchivarProspectos {
  p_tenant_id: string
  p_motivo: string
  p_actor_id: string | null
  // Batch Cleanup
  p_dias_inactividad: number | null
  p_columnas: string[] | null
  // Behavioral Cleanup
  p_min_pedidos: number | null
  p_dias_sin_respuesta: number | null
}
