/**
 * src/features/auditoria/services/archiver.service.ts
 *
 * Utilidad server-side para operaciones de archivo de prospectos.
 * A diferencia de src/features/kanban/services/archiver.service.ts
 * (que es código de browser que llama a API Routes), este módulo
 * usa Supabase directamente y está pensado para:
 *   - Tests de integración (con service role key)
 *   - Scripts de mantenimiento server-side
 *   - Unit tests con vi.spyOn sobre el singleton `supabase`
 *
 * NOTA: En la API Route real (/api/kanban/archivar) se usa la función
 * PG `archivar_prospectos()` que ejecuta todo en una transacción atómica.
 * Este servicio es una utilidad auxiliar, no el camino crítico de producción.
 */

import { supabase } from '@/lib/supabase'

export interface ArchivarInput {
  /** prospecto_id (UUID) del registro a archivar */
  id: string
}

/**
 * Mueve un prospecto de la tabla activa a prospectos_historico.
 *
 * Pasos:
 *   1. Lee el registro actual (si no existe, lanza error)
 *   2. Inserta snapshot en prospectos_historico
 *   3. Elimina de prospectos
 *
 * En producción, preferir la función PG archivar_prospectos() vía RPC
 * que ejecuta estos pasos en una sola transacción atómica con count-check.
 */
export const archivarProspectos = async (prospecto: ArchivarInput): Promise<void> => {
  // 1. Leer registro actual
  const { data: registro, error: errorLectura } = await supabase
    .from('prospectos')
    .select('*')
    .eq('prospecto_id', prospecto.id)
    .maybeSingle()

  if (errorLectura) {
    console.error('[archivarProspectos] Error al leer prospecto:', errorLectura)
    throw new Error(`FALLO_EN_LECTURA: ${errorLectura.message}`)
  }

  if (!registro) {
    throw new Error(`PROSPECTO_NO_ENCONTRADO: ${prospecto.id}`)
  }

  // 2. Insertar snapshot en prospectos_historico
  // Cast necesario: tabla creada después de la última regeneración de types.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errorInsert } = await (supabase as any)
    .from('prospectos_historico')
    .insert({
      ...registro,
      archivo_lote_id:  crypto.randomUUID(),
      fecha_archivado:  new Date().toISOString(),
      motivo_archivado: 'Archivado manualmente via archivarProspectos()',
      metadata_json:    registro,
    })

  if (errorInsert) {
    console.error('[archivarProspectos] Error al insertar en histórico:', errorInsert)
    throw new Error(`FALLO_EN_TRANSACCION: ${errorInsert.message}`)
  }

  // 3. Eliminar de tabla activa
  const { error: errorDelete } = await supabase
    .from('prospectos')
    .delete()
    .eq('prospecto_id', prospecto.id)

  if (errorDelete) {
    console.error('[archivarProspectos] Error al eliminar de prospectos:', errorDelete)
    throw new Error(`FALLO_EN_TRANSACCION: ${errorDelete.message}`)
  }
}
