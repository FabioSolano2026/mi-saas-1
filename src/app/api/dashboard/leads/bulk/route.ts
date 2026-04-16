/**
 * POST /api/dashboard/leads/bulk
 * Body: {
 *   campana_id,
 *   leads: [{nombre, telefono, correo?, temperatura?}],
 *   contexto_previo?: { historial: string, audio_url?: string }
 * }
 *
 * Inserta N leads, opcionalmente ingesta contexto histórico (IA),
 * y dispara el evento lead_iniciado del Embudo de Fuerza.
 */
import { NextResponse }                    from 'next/server'
import { z }                               from 'zod'
import { createClient }                    from '@/lib/supabase/server'
import { ingestarContextoLote }            from '@/features/agente/services/contexto-historico.service'
import { dispararLeadIniciadoLote }        from '@/features/embudo/services/embudo.service'
import type { DatosLead }                  from '@/features/embudo/services/embudo.service'
import { createClient as createAdmin }     from '@supabase/supabase-js'

const LeadItemSchema = z.object({
  nombre:      z.string().min(1).max(100),
  telefono:    z.string().max(30).optional(),
  correo:      z.string().email().optional().or(z.literal('')),
  temperatura: z.enum(['frio', 'tibio', 'caliente']).optional(),
})

const BulkSchema = z.object({
  campana_id:      z.string().uuid(),
  leads:           z.array(LeadItemSchema).min(1).max(500),
  contexto_previo: z.object({
    historial: z.string().min(10).max(20000),
    audio_url: z.string().optional(),
  }).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = BulkSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  // Insertar leads vía RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('insertar_leads_bulk', {
    p_campana_id: parsed.data.campana_id,
    p_leads:      parsed.data.leads,
  })

  if (error) {
    const status = error.message.includes('campana_not_found') ? 404
                 : error.message.includes('auth_required')     ? 401 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  const resultado = data as { creados: number; ids: string[] }

  // Obtener datos del socio una sola vez
  const { data: socio } = await supabase
    .from('socios')
    .select('tenant_id')
    .eq('usuario_id', user.id)
    .single()

  const tenantId = (socio as { tenant_id: string } | null)?.tenant_id

  if (tenantId && resultado.ids?.length) {
    // Obtener datos completos de los prospectos creados para el embudo
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prospectos } = await (admin as any)
      .from('prospectos')
      .select('prospecto_id, nombre, telefono, correo, campana_id, socio_id, tenant_id')
      .in('prospecto_id', resultado.ids)

    const leadsEmbudo: DatosLead[] = (prospectos ?? []).map((p: Record<string, unknown>) => ({
      prospecto_id: p.prospecto_id as string,
      tenant_id:    p.tenant_id    as string,
      campana_id:   p.campana_id   as string | null,
      nombre:       p.nombre       as string,
      telefono:     (p.telefono    as string | null) ?? null,
      correo:       (p.correo      as string | null) ?? null,
      socio_id:     p.socio_id     as string,
    }))

    // Fire-and-forget: embudo + contexto en paralelo (no bloquean la respuesta)
    Promise.all([
      dispararLeadIniciadoLote(leadsEmbudo).catch(() => {}),
      parsed.data.contexto_previo
        ? ingestarContextoLote({
            prospecto_ids:      resultado.ids,
            campana_id:         parsed.data.campana_id,
            tenant_id:          tenantId,
            historial_contexto: parsed.data.contexto_previo.historial,
            audio_url:          parsed.data.contexto_previo.audio_url,
          }).catch(() => {})
        : Promise.resolve(),
    ])
  }

  return NextResponse.json(
    { creados: resultado.creados, con_contexto: !!parsed.data.contexto_previo },
    { status: 201 },
  )
}
