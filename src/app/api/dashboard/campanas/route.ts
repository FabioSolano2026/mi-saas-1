/**
 * GET /api/dashboard/campanas
 *
 * Devuelve las campañas disponibles para el tipo_negocio del socio,
 * junto con su estado en socio_campanas (activo/pausado/null).
 */
import { NextResponse }  from 'next/server'
import { createClient }  from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenantId = (user.app_metadata?.tenant_id as string | undefined) ?? null
  if (!tenantId) return NextResponse.json([])

  // Obtener tipo_negocio_id del socio
  const { data: socio } = await supabase
    .from('socios')
    .select('tipo_negocio_id' as never)
    .eq('usuario_id', user.id)
    .single()

  const tipoNegocioId = (socio as { tipo_negocio_id: string | null } | null)?.tipo_negocio_id

  // Campañas del tenant filtradas por tipo_negocio (o sin tipo = globales)
  const { data: campanas, error } = await supabase
    .from('campanas')
    .select(`
      campana_id,
      nombre,
      descripcion,
      multimedia_url,
      tipo,
      agente_tipo,
      requiere_cita,
      tipo_negocio_id,
      condiciones_salud ( nombre ),
      socio_campanas!left (
        id,
        estado,
        socio_id
      )
    ` as never)
    .eq('estado', 'activa')
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filtrar por tipo_negocio + mapear estado del socio actual
  const resultado = ((campanas as unknown[]) ?? [])
    .filter((c: unknown) => {
      const camp = c as { tipo_negocio_id: string | null }
      return !camp.tipo_negocio_id || camp.tipo_negocio_id === tipoNegocioId
    })
    .map((c: unknown) => {
      const camp = c as {
        campana_id: string; nombre: string; descripcion: string | null
        multimedia_url: string | null; tipo: string; agente_tipo: string
        requiere_cita: boolean; condiciones_salud: { nombre: string } | null
        socio_campanas: Array<{ id: string; estado: string; socio_id: string }> | null
      }
      const sc = (camp.socio_campanas ?? []).find(r => r.socio_id === user.id)
      return {
        campana_id:     camp.campana_id,
        nombre:         camp.nombre,
        descripcion:    camp.descripcion,
        multimedia_url: camp.multimedia_url,
        tipo:           camp.tipo,
        agente_tipo:    camp.agente_tipo,
        requiere_cita:  camp.requiere_cita,
        condicion:      camp.condiciones_salud?.nombre ?? null,
        estado_socio:   sc?.estado ?? null,
        sc_id:          sc?.id ?? null,
      }
    })

  return NextResponse.json(resultado)
}
