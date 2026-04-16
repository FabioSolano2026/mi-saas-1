/**
 * auditoria.types.ts
 *
 * Tipos del módulo AuditorDashboard.
 *
 * Nota de diseño — Tiers vs. Roles:
 *   La tabla socios usa `tier` (free | premium_texto | premium_voz | premium_avatar)
 *   como indicador de suscripción. El sistema de acceso al dashboard de auditoría
 *   usa tier: cualquier tier distinto de 'free' puede acceder.
 *   La decisión de separar rol de tier queda documentada en ARQUITECTURA_MAESTRA.md.
 */

// ─── Tiers reales de la BD (CHECK constraint en socios.tier) ────────────────
export type SocioTier =
  | 'free'
  | 'premium_texto'
  | 'premium_voz'
  | 'premium_avatar'

/** Tiers con acceso al AuditorDashboard */
export const TIERS_CON_ACCESO_AUDITORIA: SocioTier[] = [
  'premium_texto',
  'premium_voz',
  'premium_avatar',
]

// ─── audit_logs (schema real) ────────────────────────────────────────────────

export interface AuditLog {
  log_id: string
  tenant_id: string
  /** UUID del prospecto guardado como TEXT (puede no existir ya en prospectos) */
  prospecto_id: string
  accion: 'ARCHIVE' | 'AUTO_MARK_INACTIVE' | 'RESTORE' | string
  razon: string | null
  actor_id: string | null
  timestamp: string
  metadata: Record<string, unknown>
}

// ─── prospectos_historico (campos de auditoría relevantes para la UI) ────────

export interface ProspectoHistoricoResumen {
  prospecto_id: string
  tenant_id: string
  nombre: string | null
  columna_kanban: string
  temperatura: string
  archivo_lote_id: string
  fecha_archivado: string
  motivo_archivado: string
}

// ─── Resumen para las summary cards ─────────────────────────────────────────

export interface AuditoriaResumen {
  total_activos: number
  total_historico: number
  /** % de prospectos archivados esta semana vs. total histórico acumulado */
  tasa_archivo_semana: number
  /** Últimos 5 lotes únicos de archivo */
  ultimos_lotes: LoteArchivo[]
}

export interface LoteArchivo {
  archivo_lote_id: string
  fecha_archivado: string
  total_registros: number
  motivo_archivado: string
}

// ─── Filtros para la tabla de audit_logs ────────────────────────────────────

export interface AuditoriaFiltros {
  /** ISO date string YYYY-MM-DD, inicio del rango */
  fecha_desde?: string
  /** ISO date string YYYY-MM-DD, fin del rango */
  fecha_hasta?: string
  /** Texto libre para buscar en razon o motivo_archivado */
  motivo?: string
  /** Solo mostrar una acción específica */
  accion?: string
  page?: number
  page_size?: number
}

// ─── Resultado paginado de audit_logs ───────────────────────────────────────

export interface AuditoriaLogsResult {
  logs: AuditLog[]
  total: number
  page: number
  page_size: number
}

// ─── Resultado de restaurar prospecto ───────────────────────────────────────

export interface RestaurarResult {
  prospecto_id: string
  log_id: string
}

// ─── Resultados de servicio ──────────────────────────────────────────────────

export interface AuditoriaServiceResult<T> {
  data: T | null
  error: string | null
}
