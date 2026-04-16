/**
 * POST /api/dashboard/alertas/ack
 * Body: { evento_id }
 * Marca una alerta como procesada (el socio la vio y actuó).
 */
import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const Schema = z.object({ evento_id: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const parsed = Schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 422 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from('eventos_lead')
    .update({ procesado: true })
    .eq('id', parsed.data.evento_id)

  return NextResponse.json({ ok: true })
}
