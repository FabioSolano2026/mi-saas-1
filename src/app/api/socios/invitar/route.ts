/**
 * POST /api/socios/invitar
 *
 * Registra una invitación en BD y envía el email via Supabase Auth Admin.
 * Requiere sesión activa (solo socios autenticados pueden invitar).
 */
import { NextResponse }    from 'next/server'
import { z }               from 'zod'
import { createClient }    from '@/lib/supabase/server'
import { invitarSocio }    from '@/features/onboarding/services/onboarding.service'

const InvitarSchema = z.object({
  email:           z.string().email(),
  tipo_negocio_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body   = await request.json()
  const parsed = InvitarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  const { email, tipo_negocio_id } = parsed.data
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`

  try {
    const result = await invitarSocio(email, tipo_negocio_id ?? null, redirectTo)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    const status = msg.includes('email_ya_registrado') ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
