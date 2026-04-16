/**
 * GET /api/socio/perfil
 *   → Devuelve el perfil de identidad del socio autenticado.
 *
 * PUT /api/socio/perfil
 *   Body: PerfilUpdate
 *   → Crea o actualiza el perfil de identidad (upsert).
 */

import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'

const PerfilSchema = z.object({
  voz_clonada_id:       z.string().max(100).optional(),
  voz_proveedor:        z.enum(['elevenlabs', 'resemble', 'murf', 'otro']).optional(),
  estilo_comunicacion:  z.enum(['profesional', 'amigable', 'motivacional', 'cercano']).optional(),
  tipo_cierre:          z.enum(['automatico', 'callcenter']).optional(),
  callcenter_url:       z.string().optional(),
  callcenter_telefono:  z.string().max(30).optional(),
  portal_registro_url:  z.string().optional(),
  mensaje_cierre_custom: z.string().max(2000).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: socio } = await db
    .from('socios')
    .select('nombre_completo, foto_url, avatar_url, voz_url, id_afiliado, tenant_id, rol')
    .eq('usuario_id', user.id)
    .single()

  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  const s = socio as Record<string, unknown>

  const { data: perfil } = await db
    .from('perfiles_socio')
    .select('*')
    .eq('socio_id', user.id)
    .single()

  return NextResponse.json({
    // Datos del socio
    id_afiliado:  s.id_afiliado,
    nombre:       s.nombre_completo,
    foto_url:     s.foto_url,
    avatar_url:   s.avatar_url,
    voz_url:      s.voz_url,
    rol:          s.rol ?? 'socio',
    // Perfil de identidad (puede ser null si no fue configurado)
    perfil: perfil ?? null,
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = PerfilSchema.safeParse(await request.json())
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

  // Upsert (on_conflict: socio_id es UNIQUE)
  const { data, error } = await db
    .from('perfiles_socio')
    .upsert({
      socio_id:   user.id,
      tenant_id:  (socio as Record<string, unknown>).tenant_id,
      ...parsed.data,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'socio_id' })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
