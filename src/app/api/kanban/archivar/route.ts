/**
 * POST /api/kanban/archivar
 *
 * Archiva prospectos según criterio (batch_inactividad | comportamental).
 * Llama a la función PG archivar_prospectos() que ejecuta toda la lógica
 * en una única transacción BEGIN…COMMIT:
 *   1. Identifica candidatos según criterio
 *   2. INSERT → prospectos_historico (snapshot completo + metadata_json)
 *   3. Count-check de integridad (RAISE EXCEPTION → ROLLBACK si falla)
 *   4. INSERT → audit_logs (uno por prospecto, accion: 'ARCHIVE')
 *   5. DELETE FROM prospectos
 *
 * Seguridad:
 *   - Requiere sesión activa (auth.getUser())
 *   - tenant_id y actor_id vienen del JWT — el cliente no puede suplantarlos
 *   - Zod valida el body antes de llamar a la BD
 *   - La función PG es SECURITY DEFINER — bypassa RLS (necesario para
 *     INSERT en tablas con políticas solo-lectura y DELETE en prospectos)
 */

import { NextResponse }            from 'next/server'
import { z }                       from 'zod'
import { createClient }            from '@/lib/supabase/server'
import { sendArchiveSuccess, sendArchiveError } from '@/lib/slack/slack.service'

// ─── Esquema Zod (discriminated union por type) ──────────────────────────────

const ColumnaKanbanLiteral = z.enum([
  'nuevo_prospecto',
  'contactado',
  'en_seguimiento',
  'propuesta_enviada',
  'listo_para_cerrar',
  'cliente_activo',
  'no_interesado',
  'sin_respuesta',
  'reagendar',
])

const ArchivarSchema = z.discriminatedUnion('type', [
  // Batch Cleanup — inactividad por tiempo
  z.object({
    type:     z.literal('batch_inactividad'),
    dias:     z.union([z.literal(60), z.literal(90)]),
    columnas: z.array(ColumnaKanbanLiteral).optional(),
    motivo:   z.string().min(1).max(500),
  }),
  // Behavioral Cleanup — clientes con historial que dejaron de responder
  z.object({
    type:                z.literal('comportamental'),
    min_pedidos:         z.number().int().min(1).max(9999),
    dias_sin_respuesta:  z.number().int().min(1).max(3650),
    motivo:              z.string().min(1).max(500),
  }),
])

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Parsear body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  // 2. Validar con Zod
  const parsed = ArchivarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos.', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const criteria = parsed.data

  // 3. Verificar sesión y extraer identidades del JWT
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  // tenant_id y actor_id vienen del JWT — el cliente nunca puede falsificarlos
  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? null
  const actorId  = user.id

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id no encontrado en JWT. Verificar Auth Hook.' },
      { status: 403 }
    )
  }

  // 4. Construir parámetros del RPC según el tipo de criterio.
  // Tipado inline porque archivar_prospectos() fue creada después de la última
  // regeneración de types.ts — el cast a unknown es el workaround estándar
  // del proyecto (igual que createServerClient en src/lib/supabase/server.ts).
  const rpcParams = {
    p_tenant_id:          tenantId,
    p_motivo:             criteria.motivo,
    p_actor_id:           actorId,
    p_dias_inactividad:   null as number | null,
    p_columnas:           null as string[] | null,
    p_min_pedidos:        null as number | null,
    p_dias_sin_respuesta: null as number | null,
  }

  if (criteria.type === 'batch_inactividad') {
    rpcParams.p_dias_inactividad = criteria.dias
    rpcParams.p_columnas         = criteria.columnas ?? null
  } else {
    rpcParams.p_min_pedidos        = criteria.min_pedidos
    rpcParams.p_dias_sin_respuesta = criteria.dias_sin_respuesta
  }

  // 5. Llamar a la función PG atómica.
  // archivar_prospectos() ejecuta TODO en una sola transacción.
  // Si el count-check falla → RAISE EXCEPTION → ROLLBACK automático.
  // Cast a unknown necesario: la función no está en el schema generado aún.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any)
    .rpc('archivar_prospectos', rpcParams)

  if (rpcError) {
    // El mensaje de RAISE EXCEPTION del count-check llega aquí.
    // Fire-and-forget: Slack no bloquea la respuesta al cliente.
    void sendArchiveError({
      tenant_id:     tenantId,
      motivo:        criteria.motivo,
      error_message: rpcError.message ?? 'Error desconocido en archivar_prospectos()',
      tipo:          criteria.type,
    })

    return NextResponse.json(
      { error: rpcError.message ?? 'Error al ejecutar el archivo de prospectos.' },
      { status: 500 }
    )
  }

  // 6. Notificar a Slack el resumen del lote completado.
  // Fire-and-forget: await en background — no bloquea la respuesta.
  const resultado = rpcResult as { archivados: number; lote_id: string; ids: string[] }
  void sendArchiveSuccess({
    lote_id:    resultado.lote_id   ?? '',
    archivados: resultado.archivados ?? 0,
    tenant_id:  tenantId,
    motivo:     criteria.motivo,
    tipo:       criteria.type,
  })

  // rpcResult es el JSONB devuelto: { archivados, lote_id, ids }
  return NextResponse.json(rpcResult, { status: 200 })
}
