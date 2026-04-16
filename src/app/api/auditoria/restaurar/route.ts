/**
 * POST /api/auditoria/restaurar
 *
 * Recupera un prospecto desde prospectos_historico hacia prospectos
 * y registra la acción en audit_logs con accion: 'RESTORE'.
 *
 * Body: { prospecto_id: string }
 *
 * Lógica (transacción implícita en PG):
 *   1. Leer snapshot de prospectos_historico (el más reciente por prospecto_id)
 *   2. Verificar que no existe ya en prospectos (idempotencia)
 *   3. INSERT INTO prospectos (re-inserción del snapshot)
 *   4. INSERT INTO audit_logs (accion: 'RESTORE', actor_id del JWT)
 *
 * Nota: No borramos de prospectos_historico — el histórico es inmutable.
 * El registro queda como evidencia del archivo + restauración.
 *
 * Seguridad:
 *   - Requiere sesión activa + tier != 'free'
 *   - tenant_id del JWT — el socio solo puede restaurar prospectos de su tenant
 */

import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import { TIERS_CON_ACCESO_AUDITORIA } from '@/features/auditoria/types/auditoria.types'
import type { SocioTier } from '@/features/auditoria/types/auditoria.types'

const RestaurarSchema = z.object({
  prospecto_id: z.string().uuid('prospecto_id debe ser un UUID válido.'),
})

export async function POST(request: Request) {
  // 1. Parsear body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  // 2. Validar con Zod
  const parsed = RestaurarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { prospecto_id } = parsed.data

  const supabase = await createClient()

  // 3. Sesión
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  // 4. tenant_id del JWT
  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? null
  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id no encontrado en JWT. Verificar Auth Hook.' },
      { status: 403 }
    )
  }

  // 5. Guard de tier
  const { data: socio } = await supabase
    .from('socios')
    .select('tier')
    .eq('usuario_id', user.id)
    .single()

  const tier = socio?.tier as SocioTier | undefined
  if (!tier || !TIERS_CON_ACCESO_AUDITORIA.includes(tier)) {
    return NextResponse.json(
      { error: 'Acceso denegado. Se requiere un plan premium.' },
      { status: 403 }
    )
  }

  // 6. Leer snapshot del histórico (el archivo más reciente de este prospecto)
  const { data: historico, error: histError } = await supabase
    .from('prospectos_historico')
    .select('*')
    .eq('prospecto_id', prospecto_id)
    .eq('tenant_id', tenantId)
    .order('fecha_archivado', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (histError) {
    return NextResponse.json(
      { error: histError.message ?? 'Error al leer el histórico.' },
      { status: 500 }
    )
  }

  if (!historico) {
    return NextResponse.json(
      { error: 'Prospecto no encontrado en el histórico o no pertenece a este tenant.' },
      { status: 404 }
    )
  }

  // 7. Verificar idempotencia: ¿ya existe en prospectos activos?
  const { data: yaExiste } = await supabase
    .from('prospectos')
    .select('prospecto_id')
    .eq('prospecto_id', prospecto_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (yaExiste) {
    return NextResponse.json(
      { error: 'El prospecto ya existe en la tabla activa. No se puede restaurar dos veces.' },
      { status: 409 }
    )
  }

  // 8. Re-insertar en prospectos desde el snapshot
  // Excluimos los campos de auditoría de prospectos_historico que no existen en prospectos
  const {
    archivo_lote_id: _lote,
    fecha_archivado: _fecha,
    motivo_archivado: _motivo,
    metadata_json: _meta,
    ...camposProspecto
  } = historico

  const { error: insertError } = await supabase
    .from('prospectos')
    .insert({
      ...camposProspecto,
      // Restaurar en columna_kanban segura: nuevo_prospecto
      // (la columna de origen puede ya no ser apropiada)
      columna_kanban: 'nuevo_prospecto',
      // Resetear dias_sin_contacto al restaurar
      dias_sin_contacto: 0,
      // actualizado_en lo pone el trigger set_actualizado_en
    })

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? 'Error al restaurar el prospecto.' },
      { status: 500 }
    )
  }

  // 9. Registrar en audit_logs
  const { data: logEntry, error: logError } = await supabase
    .from('audit_logs')
    .insert({
      tenant_id:    tenantId,
      prospecto_id: prospecto_id,
      accion:       'RESTORE',
      razon:        `Restaurado manualmente desde histórico. Lote origen: ${historico.archivo_lote_id}`,
      actor_id:     user.id,
      metadata: {
        lote_origen:      historico.archivo_lote_id,
        fecha_archivado:  historico.fecha_archivado,
        motivo_archivado: historico.motivo_archivado,
        restaurado_en:    new Date().toISOString(),
      },
    })
    .select('log_id')
    .single()

  if (logError) {
    // El prospecto ya fue restaurado pero el log falló — situación excepcional.
    // No hacemos rollback (el prospecto restaurado es correcto).
    // Reportamos el error para que el operador lo registre manualmente.
    console.error('[RESTORE] audit_log insert failed:', logError.message)
    return NextResponse.json(
      { error: 'Prospecto restaurado, pero el log de auditoría falló. Reportar al administrador.' },
      { status: 207 }
    )
  }

  return NextResponse.json({
    prospecto_id,
    log_id: logEntry.log_id,
  })
}
