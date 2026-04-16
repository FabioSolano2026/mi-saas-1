/**
 * GET /api/admin/audios-calidad
 *   Query params:
 *     - solo_problemas=true  → filtra solo audios con requiere_regrabacion=true
 *     - socio_id=<uuid>      → filtra un socio específico
 *
 *   → Devuelve lista de socios con sus métricas de calidad de audio.
 *     Solo auditores/admin.
 */

import { NextResponse }           from 'next/server'
import { createClient }           from '@/lib/supabase/server'
import { createClient as adminSb} from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Verificar auditor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db0 = supabase as any
  const { data: socioAuth } = await db0
    .from('socios')
    .select('rol')
    .eq('usuario_id', user.id)
    .single()

  const authRol = (socioAuth as Record<string, unknown> | null)?.rol as string | undefined
  if (!authRol || authRol === 'socio') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const soloProblemas    = searchParams.get('solo_problemas') === 'true'
  const filtroSocioId    = searchParams.get('socio_id')

  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // JOIN audios_socio + socios para obtener nombre del socio
  let query = db
    .from('audios_socio')
    .select(`
      id, clave, estado, audio_url,
      lufs_estimado, snr_estimado, pico_db,
      duracion_segundos, requiere_regrabacion,
      creado_en, actualizado_en,
      socios!audios_socio_socio_id_fkey (
        nombre_completo, usuario_id
      )
    `)
    .order('snr_estimado', { ascending: true, nullsFirst: false })

  if (soloProblemas) query = query.eq('requiere_regrabacion', true)
  if (filtroSocioId) query = query.eq('socio_id', filtroSocioId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agrupar por socio
  const socios = new Map<string, {
    socio_id: string
    nombre: string
    audios: unknown[]
    resumen: { total: number; con_audio: number; problemas: number; snr_promedio: number | null }
  }>()

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const s = row.socios as Record<string, unknown> | null
    const socioId = (s?.usuario_id ?? 'unknown') as string
    const nombre  = (s?.nombre_completo ?? 'Desconocido') as string

    if (!socios.has(socioId)) {
      socios.set(socioId, {
        socio_id: socioId,
        nombre,
        audios:   [],
        resumen:  { total: 0, con_audio: 0, problemas: 0, snr_promedio: null },
      })
    }

    const entry = socios.get(socioId)!
    entry.audios.push({
      clave:               row.clave,
      estado:              row.estado,
      tiene_audio:         !!row.audio_url,
      lufs_estimado:       row.lufs_estimado,
      snr_estimado:        row.snr_estimado,
      pico_db:             row.pico_db,
      duracion_segundos:   row.duracion_segundos,
      requiere_regrabacion:row.requiere_regrabacion,
      actualizado_en:      row.actualizado_en,
    })

    entry.resumen.total++
    if (row.audio_url)            entry.resumen.con_audio++
    if (row.requiere_regrabacion) entry.resumen.problemas++
  }

  // Calcular SNR promedio por socio
  for (const [, entry] of socios) {
    const snrs = (entry.audios as Array<Record<string, unknown>>)
      .map(a => a.snr_estimado as number | null)
      .filter((v): v is number => v !== null)
    entry.resumen.snr_promedio = snrs.length
      ? Math.round((snrs.reduce((a, b) => a + b, 0) / snrs.length) * 10) / 10
      : null
  }

  return NextResponse.json({
    total_socios:   socios.size,
    socios:         Array.from(socios.values()).sort((a, b) => b.resumen.problemas - a.resumen.problemas),
  })
}
