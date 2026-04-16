import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// GET /api/notificaciones — lista notificaciones del socio
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const soloNoEnviadas = searchParams.get('no_enviadas') !== 'false'

  let query = supabase
    .from('notificaciones')
    .select('*')
    .eq('socio_id', user.id)
    .order('creado_en', { ascending: false })
    .limit(50)

  if (soloNoEnviadas) {
    query = query.eq('enviada', false)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ notificaciones: data })
}

const MarcarEnviadaSchema = z.object({
  notif_id: z.string().uuid(),
})

// PATCH /api/notificaciones — marcar como enviada/leída
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = MarcarEnviadaSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('notificaciones')
    .update({ enviada: true, enviada_en: new Date().toISOString() })
    .eq('notif_id', parsed.data.notif_id)
    .eq('socio_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
