/**
 * GET /api/socio/afiliaciones
 *   → Lista todas las afiliaciones del socio (leads en proceso/completados).
 *
 * PATCH /api/socio/afiliaciones/[id]
 *   → Actualiza estado de una afiliación (ver ruta dinámica).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerAfiliacionesSocio } from '@/features/embudo/services/afiliacion.service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('tenant_id')
    .eq('usuario_id', user.id)
    .single()

  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const afiliaciones = await obtenerAfiliacionesSocio(
    user.id,
    (socio as Record<string, unknown>).tenant_id as string,
  )

  return NextResponse.json(afiliaciones)
}
