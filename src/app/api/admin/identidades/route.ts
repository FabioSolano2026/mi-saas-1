/**
 * GET /api/admin/identidades
 *   → Lista todos los socios con su estado de aprobación de identidad.
 *     Solo auditores.
 *
 * Query params:
 *   - solo_pendientes=true → filtra socios que no están completamente aprobados
 */

import { NextResponse }           from 'next/server'
import { createClient }           from '@/lib/supabase/server'
import { createClient as adminSb} from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db0 = supabase as any
  const { data: yo } = await db0
    .from('socios')
    .select('rol, tenant_id')
    .eq('usuario_id', user.id)
    .single()

  const yoRol = (yo as Record<string, unknown> | null)?.rol as string | undefined
  if (!yoRol || yoRol === 'socio') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const soloPendientes   = searchParams.get('solo_pendientes') === 'true'
  const tenantId         = (yo as Record<string, unknown>).tenant_id as string

  const admin = adminSb(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Socios del mismo tenant con su perfil de identidad
  const { data: socios, error } = await db
    .from('socios')
    .select(`
      usuario_id, nombre_completo, foto_url, avatar_url, id_afiliado,
      perfiles_socio (
        voz_aprobada, avatar_aprobado,
        voz_clonada_id, nota_validacion, validado_en
      )
    `)
    .eq('tenant_id', tenantId)
    .neq('usuario_id', user.id)  // excluir al propio auditor
    .order('nombre_completo')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Contar audios pendientes por socio
  const { data: audioCounts } = await db
    .from('audios_socio')
    .select('socio_id, estado')
    .eq('tenant_id', tenantId)
    .not('audio_url', 'is', null)

  // Agrupar conteos
  const countMap = new Map<string, { pendiente: number; validado: number; rechazado: number; total: number }>()
  for (const row of (audioCounts ?? []) as Array<Record<string, string>>) {
    const id = row.socio_id
    if (!countMap.has(id)) countMap.set(id, { pendiente: 0, validado: 0, rechazado: 0, total: 0 })
    const c = countMap.get(id)!
    c.total++
    if (row.estado === 'pendiente')  c.pendiente++
    if (row.estado === 'validado')   c.validado++
    if (row.estado === 'rechazado')  c.rechazado++
  }

  const result = ((socios ?? []) as Array<Record<string, unknown>>).map(s => {
    const p = (Array.isArray(s.perfiles_socio)
      ? (s.perfiles_socio[0] ?? {})
      : (s.perfiles_socio ?? {})) as Record<string, unknown>

    const counts = countMap.get(s.usuario_id as string) ?? { pendiente: 0, validado: 0, rechazado: 0, total: 0 }
    const tieneVozPendiente  = !!p.voz_clonada_id    && !p.voz_aprobada
    const hayAudiosRevisables = counts.pendiente > 0

    return {
      socio_id:       s.usuario_id,
      nombre:         s.nombre_completo,
      foto_url:       s.foto_url,
      id_afiliado:    s.id_afiliado,
      voz_aprobada:   p.voz_aprobada    ?? false,
      avatar_aprobado:p.avatar_aprobado ?? false,
      voz_clonada_id: p.voz_clonada_id  ?? null,
      nota_validacion:p.nota_validacion ?? null,
      validado_en:    p.validado_en     ?? null,
      audios:         counts,
      pendiente_revision: tieneVozPendiente || hayAudiosRevisables,
    }
  })

  const filtrado = soloPendientes ? result.filter(s => s.pendiente_revision) : result

  return NextResponse.json({
    total:   filtrado.length,
    socios:  filtrado,
  })
}
