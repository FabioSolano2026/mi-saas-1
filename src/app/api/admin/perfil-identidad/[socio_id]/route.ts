/**
 * GET  /api/admin/perfil-identidad/[socio_id]
 *   → Devuelve perfil completo + audios del socio para revisión.
 *
 * PUT  /api/admin/perfil-identidad/[socio_id]
 *   Body: { voz_aprobada?, avatar_aprobado?, nota_validacion?, audio_clave?, audio_estado? }
 *   → Aprueba / rechaza assets del socio. Solo auditores/admin.
 */

import { NextResponse }             from 'next/server'
import { z }                        from 'zod'
import { createClient }             from '@/lib/supabase/server'
import { createClient as adminSb }  from '@supabase/supabase-js'

const ApprovalSchema = z.object({
  // Validación del perfil
  voz_aprobada:     z.boolean().optional(),
  avatar_aprobado:  z.boolean().optional(),
  nota_validacion:  z.string().max(500).optional(),
  // Validación de un audio individual
  audio_clave:      z.string().optional(),
  audio_estado:     z.enum(['validado', 'rechazado', 'pendiente']).optional(),
  audio_nota:       z.string().max(500).optional(),
})

async function verificarAuditor(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data } = await db
    .from('socios')
    .select('rol')
    .eq('usuario_id', userId)
    .single()
  const r = (data as Record<string, unknown> | null)?.rol as string | undefined
  return !!r && r !== 'socio'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ socio_id: string }> },
) {
  const { socio_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const esAuditor = await verificarAuditor(supabase, user.id)
  if (!esAuditor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const [{ data: socio }, { data: perfil }, { data: audios }] = await Promise.all([
    db.from('socios').select('nombre_completo, foto_url, avatar_url, id_afiliado').eq('usuario_id', socio_id).single(),
    db.from('perfiles_socio').select('*').eq('socio_id', socio_id).single(),
    db.from('audios_socio').select('id, clave, guion, audio_url, estado, nota_admin, validado_en').eq('socio_id', socio_id),
  ])

  // Generar URLs firmadas para audios
  const audiosConUrl = await Promise.all(
    ((audios ?? []) as Array<Record<string, unknown>>).map(async (a) => {
      const urlPath = a.audio_url as string | null
      let signed_url: string | null = null
      if (urlPath && !urlPath.startsWith('http')) {
        const { data } = await admin.storage.from('audios_socio').createSignedUrl(urlPath, 3600)
        signed_url = data?.signedUrl ?? null
      } else {
        signed_url = urlPath
      }
      return { ...a, signed_url }
    }),
  )

  return NextResponse.json({ socio, perfil, audios: audiosConUrl })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ socio_id: string }> },
) {
  const { socio_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const esAuditor = await verificarAuditor(supabase, user.id)
  if (!esAuditor) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const parsed = ApprovalSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const ahora = new Date().toISOString()
  const results: Record<string, unknown> = {}

  // Actualizar perfil de identidad
  const perfilUpdate: Record<string, unknown> = {}
  if (parsed.data.voz_aprobada    !== undefined) perfilUpdate.voz_aprobada    = parsed.data.voz_aprobada
  if (parsed.data.avatar_aprobado !== undefined) perfilUpdate.avatar_aprobado = parsed.data.avatar_aprobado
  if (parsed.data.nota_validacion !== undefined) perfilUpdate.nota_validacion = parsed.data.nota_validacion

  if (Object.keys(perfilUpdate).length > 0) {
    perfilUpdate.validado_por = user.id
    perfilUpdate.validado_en  = ahora
    const { error } = await db
      .from('perfiles_socio')
      .update(perfilUpdate)
      .eq('socio_id', socio_id)
    results.perfil = error ? { error: error.message } : { ok: true }
  }

  // Actualizar estado de un audio individual
  if (parsed.data.audio_clave && parsed.data.audio_estado) {
    const audioUpdate: Record<string, unknown> = {
      estado:       parsed.data.audio_estado,
      validado_por: user.id,
      validado_en:  ahora,
      actualizado_en: ahora,
    }
    if (parsed.data.audio_nota !== undefined) audioUpdate.nota_admin = parsed.data.audio_nota

    const { error } = await db
      .from('audios_socio')
      .update(audioUpdate)
      .eq('socio_id', socio_id)
      .eq('clave', parsed.data.audio_clave)
    results.audio = error ? { error: error.message } : { ok: true, clave: parsed.data.audio_clave }
  }

  return NextResponse.json(results)
}
