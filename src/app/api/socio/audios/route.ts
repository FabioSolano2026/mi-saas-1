/**
 * GET  /api/socio/audios
 *   → Lista todas las frases maestras del socio (combinado con BD).
 *
 * POST /api/socio/audios
 *   Body: { clave, guion }
 *   → Upsert del guion personalizado de una frase.
 */

import { NextResponse }  from 'next/server'
import { z }             from 'zod'
import { createClient }  from '@/lib/supabase/server'
import { cargarFrasesSocio } from '@/features/agente/services/voice-middleware.service'

const GuionSchema = z.object({
  clave:  z.string().min(1).max(100),
  guion:  z.string().min(1).max(3000),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const frases = await cargarFrasesSocio(user.id).catch(() => [])
  return NextResponse.json(frases)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = GuionSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: socio } = await db
    .from('socios')
    .select('tenant_id')
    .eq('usuario_id', user.id)
    .single()

  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const { data, error } = await db
    .from('audios_socio')
    .upsert({
      socio_id:       user.id,
      tenant_id:      (socio as Record<string, unknown>).tenant_id,
      clave:          parsed.data.clave,
      guion:          parsed.data.guion,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'socio_id,clave' })
    .select('id, clave, guion, audio_url, estado')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
