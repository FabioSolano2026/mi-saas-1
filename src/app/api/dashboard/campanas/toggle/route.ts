/**
 * POST /api/dashboard/campanas/toggle
 * Body: { campana_id: string }
 *
 * Activa o pausa la relación socio ↔ campaña via RPC toggle_socio_campana.
 */
import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'

const Schema = z.object({ campana_id: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'campana_id inválido' }, { status: 422 })

  const { data, error } = await (supabase as unknown as { rpc: Function }).rpc(
    'toggle_socio_campana', { p_campana_id: parsed.data.campana_id }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
