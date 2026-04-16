import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MoverSchema = z.object({
  prospecto_id: z.string().uuid(),
  destino: z.string().min(1),
  nota: z.string().optional(),
})

// POST /api/kanban/mover
// Llama a la función atómica mover_kanban() en Supabase
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = MoverSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { prospecto_id, destino, nota } = parsed.data

  const { data, error } = await supabase.rpc('mover_kanban', {
    p_prospecto_id: prospecto_id,
    p_socio_id: user.id,
    p_destino: destino,
    p_nota: nota ?? undefined,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, movimiento_id: data })
}
