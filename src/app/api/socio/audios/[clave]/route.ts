/**
 * DELETE /api/socio/audios/[clave]
 *   → Elimina el audio grabado de una frase (resetea a pendiente).
 *     Borra el archivo de Storage Y limpia audio_url + estado en BD.
 */

import { NextResponse }  from 'next/server'
import { createClient }  from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clave: string }> },
) {
  const { clave } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Buscar el registro actual
  const { data: frase } = await db
    .from('audios_socio')
    .select('id, audio_url')
    .eq('socio_id', user.id)
    .eq('clave', clave)
    .single()

  if (!frase) {
    return NextResponse.json({ error: 'Frase no encontrada' }, { status: 404 })
  }

  const f = frase as Record<string, unknown>

  // Borrar de Storage si existe un archivo (path relativo)
  const audioUrl = f.audio_url as string | null
  if (audioUrl && !audioUrl.startsWith('http')) {
    await supabase.storage
      .from('audios_socio')
      .remove([audioUrl])
      .catch(() => {})
  }

  // Resetear audio_url + estado a pendiente
  const { error } = await db
    .from('audios_socio')
    .update({
      audio_url:      null,
      estado:         'pendiente',
      validado_por:   null,
      validado_en:    null,
      nota_admin:     null,
      actualizado_en: new Date().toISOString(),
    })
    .eq('socio_id', user.id)
    .eq('clave', clave)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
