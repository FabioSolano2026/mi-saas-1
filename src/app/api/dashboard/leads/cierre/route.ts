/**
 * POST /api/dashboard/leads/cierre
 * Body: { prospecto_id, resumen_agente? }
 *
 * Switch de Cierre — activa listo_cierre para un lead:
 *  1. Cambia estado_temperatura → 'listo_cierre'
 *  2. Mueve al kanban → 'propuesta_enviada'
 *  3. Encola alerta para el socio
 *  4. Retorna la alerta para mostrar en UI
 *
 * Llamado internamente por el agente cuando detecta señal de cierre.
 * También puede ser llamado manualmente por el socio desde el Kanban.
 */

import { NextResponse }          from 'next/server'
import { z }                     from 'zod'
import { createClient }          from '@/lib/supabase/server'
import { activarSwitchCierre }   from '@/features/embudo/services/embudo.service'

const Schema = z.object({
  prospecto_id:   z.string().uuid(),
  resumen_agente: z.string().max(2000).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  const alerta = await activarSwitchCierre(
    parsed.data.prospecto_id,
    parsed.data.resumen_agente ?? null,
  )

  if (!alerta) {
    return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  }

  return NextResponse.json(alerta)
}
