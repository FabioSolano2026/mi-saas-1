/**
 * GET /api/socio/audios/signed-url?path=<storage_path>
 *   → Genera URL firmada (1h) para reproducir un audio del socio.
 *     Solo el socio dueño puede solicitarla.
 */

import { NextResponse }  from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { createClient as adminSb } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Falta path' }, { status: 400 })

  // Verificar que el path pertenece al socio (path format: {user_id}/{clave}.ext)
  if (!path.startsWith(user.id + '/')) {
    return NextResponse.json({ error: 'Sin permisos para este archivo' }, { status: 403 })
  }

  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await admin.storage
    .from('audios_socio')
    .createSignedUrl(path, 3600)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo firmar la URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
