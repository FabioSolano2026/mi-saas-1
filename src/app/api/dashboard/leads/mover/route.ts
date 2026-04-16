/**
 * POST /api/dashboard/leads/mover
 * Body: { prospecto_id, destino, nota? }
 *
 * Cambia la columna kanban de un lead via RPC actualizar_columna_lead.
 * La RPC verifica que el lead pertenezca al socio autenticado.
 */
import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ColumnaKanban } from '@/features/dashboard/types/dashboard.types'

const COLUMNAS_VALIDAS: ColumnaKanban[] = [
  'nuevo_prospecto','contactado','calificado','interesado',
  'propuesta_enviada','negociacion','cliente_activo','perdido','descartado',
]

const Schema = z.object({
  prospecto_id: z.string().uuid(),
  destino:      z.enum(COLUMNAS_VALIDAS as [ColumnaKanban, ...ColumnaKanban[]]),
  nota:         z.string().max(500).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 })

  const { data, error } = await (supabase as unknown as { rpc: Function }).rpc(
    'actualizar_columna_lead', {
      p_prospecto_id: parsed.data.prospecto_id,
      p_destino:      parsed.data.destino,
      p_nota:         parsed.data.nota ?? null,
    }
  )

  if (error) {
    const status = error.message.includes('unauthorized') ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json(data)
}
