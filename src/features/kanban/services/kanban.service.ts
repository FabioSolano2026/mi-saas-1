/**
 * kanban.service.ts
 *
 * Capa de datos del Kanban. Todas las funciones pasan por las API Routes
 * del Sprint 2 — NUNCA llaman a Supabase directamente desde el browser.
 *
 * Garantía RLS: el servidor aplica automáticamente el filtro por tenant_id
 * del JWT en cada request. El frontend no necesita (ni puede) enviarlo
 * manualmente — el middleware de sesión lo maneja.
 *
 * Flujo:
 *   Componente → kanban.service → /api/kanban/* → Supabase + RLS → datos del tenant
 */

import type {
  TableroKanban,
  MoverProspectoPayload,
  KanbanServiceResult,
  ColumnaKanban,
  Prospecto,
} from '../types/kanban.types'
import { COLUMNAS_KANBAN } from '../types/kanban.types'

// ─────────────────────────────────────────────────────────────
// getProspectos
// Llama GET /api/kanban/prospectos y devuelve el tablero
// agrupado por columna_kanban.
//
// Seguridad: el endpoint verifica auth.getUser() — si no hay
// sesión devuelve 401 y esta función retorna error.
// RLS en BD filtra automáticamente por tenant_id del JWT.
// ─────────────────────────────────────────────────────────────
export async function getProspectos(): Promise<KanbanServiceResult<TableroKanban>> {
  try {
    const res = await fetch('/api/kanban/prospectos', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // credentials: 'include' garantiza que la cookie de sesión viaja con el request
      credentials: 'include',
    })

    if (res.status === 401) {
      return { data: null, error: 'Sesión expirada. Por favor inicia sesión nuevamente.' }
    }

    if (!res.ok) {
      const body = await res.json()
      return { data: null, error: body.error ?? 'Error al cargar el tablero.' }
    }

    const json = await res.json()

    // La API devuelve { columnas: Record<string, Prospecto[]> }
    // Normalizamos: garantizamos que todas las 9 columnas existan aunque estén vacías
    const tablero = {} as TableroKanban
    for (const col of COLUMNAS_KANBAN) {
      tablero[col] = (json.columnas?.[col] ?? []) as Prospecto[]
    }

    return { data: tablero, error: null }
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor.' }
  }
}

// ─────────────────────────────────────────────────────────────
// moverProspecto
// Llama POST /api/kanban/mover — ejecuta la función atómica
// mover_kanban() en Supabase que mueve el prospecto Y registra
// el movimiento en movimientos_kanban (audit trail inmutable).
//
// Seguridad: el endpoint valida con Zod + verifica auth.getUser().
// El socio_id lo toma el servidor del JWT — el frontend no lo envía.
// ─────────────────────────────────────────────────────────────
export async function moverProspecto(
  payload: MoverProspectoPayload
): Promise<KanbanServiceResult<boolean>> {
  try {
    const res = await fetch('/api/kanban/mover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        prospecto_id: payload.prospecto_id,
        destino: payload.destino,
        nota: payload.nota,
      }),
    })

    if (res.status === 401) {
      return { data: null, error: 'Sesión expirada. Por favor inicia sesión nuevamente.' }
    }

    if (!res.ok) {
      const body = await res.json()
      return { data: null, error: body.error ?? 'Error al mover el prospecto.' }
    }

    return { data: true, error: null }
  } catch {
    return { data: null, error: 'No se pudo conectar con el servidor.' }
  }
}

// ─────────────────────────────────────────────────────────────
// getProspectosPorColumna
// Helper que filtra el tablero por una columna específica.
// Opera sobre datos ya cargados — no hace fetch adicional.
// ─────────────────────────────────────────────────────────────
export function getProspectosPorColumna(
  tablero: TableroKanban,
  columna: ColumnaKanban
): Prospecto[] {
  return tablero[columna] ?? []
}

// ─────────────────────────────────────────────────────────────
// contarProspectos
// Devuelve el total de prospectos activos en el tablero
// (excluye columnas finales: perdido, descartado).
// ─────────────────────────────────────────────────────────────
export function contarProspectosActivos(tablero: TableroKanban): number {
  const COLUMNAS_FINALES: ColumnaKanban[] = ['cliente_activo', 'no_interesado']
  return COLUMNAS_KANBAN.filter((col) => !COLUMNAS_FINALES.includes(col)).reduce(
    (total, col) => total + tablero[col].length,
    0
  )
}
