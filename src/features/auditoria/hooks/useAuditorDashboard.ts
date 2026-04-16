/**
 * useAuditorDashboard.ts
 *
 * Hook central del AuditorDashboard.
 * Coordina los 3 endpoints de auditoría y expone:
 *   - resumen: summary cards (activos, histórico, tasa, lotes)
 *   - logs: audit_logs paginados y filtrables
 *   - restaurar: función de recuperación con estado de carga
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import type {
  AuditoriaResumen,
  AuditoriaLogsResult,
  AuditoriaFiltros,
  RestaurarResult,
  AuditoriaServiceResult,
} from '../types/auditoria.types'

// ─── Estado del hook ─────────────────────────────────────────────────────────

interface AuditorDashboardState {
  resumen: AuditoriaResumen | null
  logsResult: AuditoriaLogsResult | null
  loadingResumen: boolean
  loadingLogs: boolean
  errorResumen: string | null
  errorLogs: string | null
  filtros: AuditoriaFiltros
  // Restaurar
  restaurando: boolean
  errorRestaurar: string | null
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuditorDashboard() {
  const [state, setState] = useState<AuditorDashboardState>({
    resumen:        null,
    logsResult:     null,
    loadingResumen: true,
    loadingLogs:    true,
    errorResumen:   null,
    errorLogs:      null,
    filtros: { page: 1, page_size: 20 },
    restaurando:    false,
    errorRestaurar: null,
  })

  // ── Cargar resumen (summary cards) ──────────────────────────────────────
  const cargarResumen = useCallback(async () => {
    setState(s => ({ ...s, loadingResumen: true, errorResumen: null }))
    try {
      const res = await fetch('/api/auditoria/resumen', { credentials: 'include' })
      if (res.status === 401) {
        setState(s => ({ ...s, loadingResumen: false, errorResumen: 'Sesión expirada.' }))
        return
      }
      if (res.status === 403) {
        const body = await res.json()
        setState(s => ({ ...s, loadingResumen: false, errorResumen: body.error }))
        return
      }
      if (!res.ok) {
        const body = await res.json()
        setState(s => ({ ...s, loadingResumen: false, errorResumen: body.error ?? 'Error al cargar resumen.' }))
        return
      }
      const data: AuditoriaResumen = await res.json()
      setState(s => ({ ...s, resumen: data, loadingResumen: false }))
    } catch {
      setState(s => ({ ...s, loadingResumen: false, errorResumen: 'No se pudo conectar.' }))
    }
  }, [])

  // ── Cargar logs (tabla paginada) ─────────────────────────────────────────
  const cargarLogs = useCallback(async (filtros: AuditoriaFiltros) => {
    setState(s => ({ ...s, loadingLogs: true, errorLogs: null }))
    try {
      const params = new URLSearchParams()
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
      if (filtros.motivo)      params.set('motivo', filtros.motivo)
      if (filtros.accion)      params.set('accion', filtros.accion)
      params.set('page',      String(filtros.page      ?? 1))
      params.set('page_size', String(filtros.page_size ?? 20))

      const res = await fetch(`/api/auditoria/logs?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json()
        setState(s => ({ ...s, loadingLogs: false, errorLogs: body.error ?? 'Error al cargar logs.' }))
        return
      }
      const data: AuditoriaLogsResult = await res.json()
      setState(s => ({ ...s, logsResult: data, loadingLogs: false }))
    } catch {
      setState(s => ({ ...s, loadingLogs: false, errorLogs: 'No se pudo conectar.' }))
    }
  }, [])

  // ── Actualizar filtros y recargar logs ───────────────────────────────────
  const actualizarFiltros = useCallback((nuevos: Partial<AuditoriaFiltros>) => {
    setState(s => {
      const filtrosActualizados = { ...s.filtros, ...nuevos, page: 1 }
      // Disparar carga asíncrona
      cargarLogs(filtrosActualizados)
      return { ...s, filtros: filtrosActualizados }
    })
  }, [cargarLogs])

  const cambiarPagina = useCallback((page: number) => {
    setState(s => {
      const filtrosActualizados = { ...s.filtros, page }
      cargarLogs(filtrosActualizados)
      return { ...s, filtros: filtrosActualizados }
    })
  }, [cargarLogs])

  // ── Restaurar prospecto ──────────────────────────────────────────────────
  const restaurar = useCallback(async (
    prospectoId: string,
    onExito?: (result: RestaurarResult) => void
  ): Promise<AuditoriaServiceResult<RestaurarResult>> => {
    setState(s => ({ ...s, restaurando: true, errorRestaurar: null }))
    try {
      const res = await fetch('/api/auditoria/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prospecto_id: prospectoId }),
      })

      if (!res.ok) {
        const body = await res.json()
        const err = body.error ?? 'Error al restaurar.'
        setState(s => ({ ...s, restaurando: false, errorRestaurar: err }))
        return { data: null, error: err }
      }

      const data: RestaurarResult = await res.json()
      setState(s => ({ ...s, restaurando: false }))
      // Refrescar resumen y logs después de restaurar
      cargarResumen()
      cargarLogs(state.filtros)
      onExito?.(data)
      return { data, error: null }
    } catch {
      const err = 'No se pudo conectar.'
      setState(s => ({ ...s, restaurando: false, errorRestaurar: err }))
      return { data: null, error: err }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarResumen, cargarLogs])

  // ── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    cargarResumen()
    cargarLogs({ page: 1, page_size: 20 })
  }, [cargarResumen, cargarLogs])

  return {
    // Data
    resumen:        state.resumen,
    logsResult:     state.logsResult,
    filtros:        state.filtros,
    // Loading
    loadingResumen: state.loadingResumen,
    loadingLogs:    state.loadingLogs,
    // Errors
    errorResumen:   state.errorResumen,
    errorLogs:      state.errorLogs,
    errorRestaurar: state.errorRestaurar,
    // Actions
    actualizarFiltros,
    cambiarPagina,
    restaurar,
    recargar:       () => { cargarResumen(); cargarLogs(state.filtros) },
    restaurando:    state.restaurando,
  }
}
