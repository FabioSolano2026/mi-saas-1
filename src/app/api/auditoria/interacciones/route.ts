/**
 * GET  /api/auditoria/interacciones?prospecto_id=...
 *   → Devuelve interacciones del prospecto.
 *     Socios ven solo 'texto'. Auditores ven todo + datos privados.
 *
 * POST /api/auditoria/interacciones
 *   Body: CrearInteraccionPayload
 *   → Inserta interacción (y privado si aplica). Solo server/agente.
 */

import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CrearSchema = z.object({
  prospecto_id:  z.string().uuid(),
  campana_id:    z.string().uuid().optional(),
  tipo:          z.enum(['texto', 'voz']),
  contenido:     z.string().max(10000).optional(),
  emisor:        z.enum(['agente', 'socio', 'lead']),
  audio_url:     z.string().optional(),
  transcripcion: z.string().max(50000).optional(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminDb(): any {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const prospectoId = searchParams.get('prospecto_id')
  if (!prospectoId) return NextResponse.json({ error: 'prospecto_id requerido' }, { status: 400 })

  // ¿Es auditor?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('rol')
    .eq('usuario_id', user.id)
    .single()

  const esAuditor = ((socio as { rol?: string } | null)?.rol ?? 'socio') !== 'socio'

  if (esAuditor) {
    const { data, error } = await adminDb()
      .from('interacciones_leads')
      .select(`
        id, tipo, contenido, emisor, creado_en,
        interacciones_privado (
          audio_url, transcripcion, score_cumplimiento, score_detalle_json
        )
      `)
      .eq('prospecto_id', prospectoId)
      .order('creado_en', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Socio: solo tipo='texto' (RLS filtra automáticamente)
  const { data, error } = await adminDb()
    .from('interacciones_leads')
    .select('id, tipo, contenido, emisor, creado_en')
    .eq('prospecto_id', prospectoId)
    .order('creado_en', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const parsed = CrearSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  const admin = adminDb()
  const { audio_url, transcripcion, ...camposPublicos } = parsed.data

  const { data: prospecto } = await admin
    .from('prospectos')
    .select('tenant_id, campana_id')
    .eq('prospecto_id', camposPublicos.prospecto_id)
    .single()

  if (!prospecto) return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 })

  const { data: interaccion, error: errI } = await admin
    .from('interacciones_leads')
    .insert({
      ...camposPublicos,
      campana_id: camposPublicos.campana_id ?? (prospecto as { campana_id: string }).campana_id,
      tenant_id:  (prospecto as { tenant_id: string }).tenant_id,
    })
    .select('id')
    .single()

  if (errI) return NextResponse.json({ error: errI.message }, { status: 500 })

  if (audio_url || transcripcion) {
    const { error: errP } = await admin
      .from('interacciones_privado')
      .insert({
        interaccion_id: (interaccion as { id: string }).id,
        audio_url:      audio_url ?? null,
        transcripcion:  transcripcion ?? null,
      })

    if (errP) return NextResponse.json({ error: errP.message }, { status: 500 })
  }

  return NextResponse.json({ id: (interaccion as { id: string }).id }, { status: 201 })
}
