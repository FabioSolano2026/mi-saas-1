/**
 * POST /api/onboarding/completar
 *
 * Guarda los datos básicos del socio y marca onboarding_ok = true.
 */
import { NextResponse }        from 'next/server'
import { z }                   from 'zod'
import { createClient }        from '@/lib/supabase/server'
import { completarOnboarding } from '@/features/onboarding/services/onboarding.service'

const OnboardingSchema = z.object({
  nombre_completo: z.string().min(2).max(100),
  telefono:        z.string().min(7).max(20),
  foto_url:        z.string().url().nullable().optional(),
  tipo_negocio_id: z.string().uuid(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body   = await request.json()
  const parsed = OnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    await completarOnboarding(user.id, {
      nombre_completo: parsed.data.nombre_completo,
      telefono:        parsed.data.telefono,
      foto_url:        parsed.data.foto_url ?? null,
      tipo_negocio_id: parsed.data.tipo_negocio_id,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
