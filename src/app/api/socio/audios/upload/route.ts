/**
 * POST /api/socio/audios/upload
 *   Body: multipart/form-data
 *     - clave:    string          (identificador de la frase)
 *     - file:     File            (audio normalizado por el cliente)
 *     - metadata: JSON string     (AudioMetadata del procesador cliente)
 *
 * Flujo:
 *  1. Validar usuario + archivo
 *  2. Subir al bucket 'audios_socio'
 *  3. Almacenar métricas de calidad en BD
 *  4. Si snr_estimado < umbral → requiere_regrabacion = true
 *  5. Responder con frase actualizada + flag de calidad
 */

import { NextResponse }               from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { createClient as adminSb }    from '@supabase/supabase-js'

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm',
  'audio/ogg',  'audio/m4a', 'audio/x-m4a',
]
const MAX_SIZE_MB   = 25
const SNR_MINIMO_DB = 10  // debe coincidir con el procesador cliente

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Body debe ser multipart/form-data' }, { status: 400 })
  }

  const clave        = formData.get('clave')?.toString()
  const file         = formData.get('file')         as File | null
  const metaRaw      = formData.get('metadata')?.toString()

  if (!clave || !file) {
    return NextResponse.json({ error: 'Faltan campos: clave, file' }, { status: 422 })
  }

  // Parsear métricas de calidad enviadas por el cliente
  let calidad: Record<string, unknown> = {}
  try {
    if (metaRaw) calidad = JSON.parse(metaRaw) as Record<string, unknown>
  } catch { /* ignorar — no son obligatorias */ }

  // Validar tipo y tamaño
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Tipo no soportado: ${file.type}` }, { status: 422 })
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo excede ${MAX_SIZE_MB}MB` }, { status: 422 })
  }

  // Forzar extensión .wav (el cliente siempre entrega WAV normalizado)
  const ext    = file.name.endsWith('.wav') ? 'wav' : (file.name.split('.').pop()?.toLowerCase() ?? 'wav')
  const path   = `${user.id}/${clave}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Service role para Storage
  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { error: storageError } = await admin.storage
    .from('audios_socio')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: socio } = await db
    .from('socios')
    .select('tenant_id')
    .eq('usuario_id', user.id)
    .single()

  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  // Determinar si requiere regrabación basado en SNR
  const snr                 = typeof calidad.snr_estimado === 'number' ? calidad.snr_estimado : null
  const requiere_regrabacion = snr !== null && snr < SNR_MINIMO_DB

  const { data, error: dbError } = await db
    .from('audios_socio')
    .upsert({
      socio_id:              user.id,
      tenant_id:             (socio as Record<string, unknown>).tenant_id,
      clave,
      guion:                 '',       // actualizado por separado vía POST /api/socio/audios
      audio_url:             path,
      estado:                'pendiente',
      validado_por:          null,
      validado_en:           null,
      nota_admin:            null,
      // Métricas de calidad
      lufs_estimado:         calidad.lufs_estimado         ?? null,
      snr_estimado:          calidad.snr_estimado           ?? null,
      pico_db:               calidad.pico_db               ?? null,
      duracion_segundos:     calidad.duracion_segundos      ?? null,
      sample_rate_original:  calidad.sample_rate_original   ?? null,
      requiere_regrabacion,
      actualizado_en:        new Date().toISOString(),
    }, { onConflict: 'socio_id,clave' })
    .select('id, clave, audio_url, estado, snr_estimado, lufs_estimado, pico_db, duracion_segundos, requiere_regrabacion')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    path,
    frase: data,
    calidad_ok:            !requiere_regrabacion,
    snr_estimado:          snr,
    requiere_regrabacion,
  })
}
