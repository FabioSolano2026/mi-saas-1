import type { Database } from '@/lib/supabase/types'

// Tipo base derivado directamente de la BD — nunca se desincroniza
export type Prospecto = Database['public']['Tables']['prospectos']['Row']

// 9 columnas válidas — valores exactos del CHECK constraint de la BD
// prospectos_columna_kanban_check (verificado en audit-kanban.test.ts)
export const COLUMNAS_KANBAN = [
  'nuevo_prospecto',
  'contactado',
  'en_seguimiento',
  'propuesta_enviada',
  'listo_para_cerrar',
  'cliente_activo',
  'no_interesado',
  'sin_respuesta',
  'reagendar',
] as const

export type ColumnaKanban = (typeof COLUMNAS_KANBAN)[number]

// Tablero agrupado por columna — lo que devuelve getProspectos()
export type TableroKanban = Record<ColumnaKanban, Prospecto[]>

// Payload para mover un prospecto
export interface MoverProspectoPayload {
  prospecto_id: string
  destino: ColumnaKanban
  nota?: string
}

// Respuesta estándar del servicio
export interface KanbanServiceResult<T> {
  data: T | null
  error: string | null
}
