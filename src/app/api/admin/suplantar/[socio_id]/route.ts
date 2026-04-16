/**
 * POST /api/admin/suplantar/[socio_id]
 *
 * Genera un token de sesión temporal como el socio indicado.
 * Solo accesible para usuarios con rol = 'admin'.
 *
 * Flujo:
 *  1. Verifica rol='admin' en servidor
 *  2. auth.admin.generateLink({ type:'magiclink', email }) → hashed_token
 *  3. Devuelve hashed_token al frontend
 *  4. Frontend llama supabase.auth.exchangeCodeForSession(hashed_token)
 *     obteniendo una sesión real del socio sin interacción del usuario
 *
 * Restricciones de seguridad:
 *  - Solo admins pueden llamar este endpoint
 *  - No se puede suplantar a otro admin
 *  - El hashed_token expira en minutos (TTL de magic link)
 *  - La sesión original del admin se guarda en sessionStorage (nunca en servidor)
 */

import { NextResponse }                from 'next/server'
import { createClient }                from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ socio_id: string }> },
) {
  const { socio_id } = await params

  // ── 1. Verificar que el solicitante es admin ───────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: yo } = await (supabase as any)
    .from('socios')
    .select('rol')
    .eq('usuario_id', user.id)
    .single()

  if ((yo as { rol?: string } | null)?.rol !== 'admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden auditar sesiones' },
      { status: 403 },
    )
  }

  // ── 2. Verificar que el socio objetivo existe y no es admin ────────
  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any

  const { data: socioObjetivo } = await db
    .from('socios')
    .select('usuario_id, nombre_completo, rol, correo')
    .eq('usuario_id', socio_id)
    .single()

  if (!socioObjetivo) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })
  }

  const objetivo = socioObjetivo as {
    usuario_id:     string
    nombre_completo: string
    rol:            string
    correo:         string
  }

  if (objetivo.rol === 'admin') {
    return NextResponse.json(
      { error: 'No se puede auditar la sesión de un administrador' },
      { status: 403 },
    )
  }

  // ── 3. Generar magic link → hashed_token ──────────────────────────
  // generateLink crea un token de un solo uso que el frontend puede
  // canjear por una sesión real via exchangeCodeForSession()
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type:  'magiclink',
    email: objetivo.correo,
  })

  if (linkError || !linkData) {
    return NextResponse.json(
      { error: linkError?.message ?? 'Error generando token de auditoría' },
      { status: 500 },
    )
  }

  // ── 4. Devolver hashed_token (no expone email ni action_link) ──────
  return NextResponse.json({
    hashed_token: linkData.properties.hashed_token,
    socio: {
      id:     objetivo.usuario_id,
      nombre: objetivo.nombre_completo,
      rol:    objetivo.rol,
    },
  })
}
