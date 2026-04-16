import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@/lib/supabase/types'

type CampanaInsert = Database['public']['Tables']['campanas']['Insert']

// GET /api/campanas — lista campañas del socio autenticado
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('campanas')
    .select('*')
    .eq('socio_id', user.id)
    .order('fecha_inicio', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campanas: data })
}

const CampanaCreateSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(['prospeccion', 'recompra', 'referido']).default('prospeccion'),
  pais_id: z.string().uuid(),
  condicion_salud_id: z.string().uuid().optional(),
  knowledge_base_id: z.string().uuid().optional(),
  agente_tipo: z.enum(['texto', 'voz', 'avatar']).default('texto'),
  requiere_cita: z.boolean().default(false),
  modulo_destino: z.string().default('mlm_bienestar'),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional(),
})

// POST /api/campanas — crear nueva campaña
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CampanaCreateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // tenant_id viene del JWT (inyectado por el auth hook)
  const tenantId = user.app_metadata?.tenant_id as string | undefined

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id no encontrado en sesión. Verifica el Auth Hook.' }, { status: 403 })
  }

  const nuevaCampana: CampanaInsert = {
    ...parsed.data,
    socio_id: user.id,
    tenant_id: tenantId,
  }

  const { data, error } = await supabase
    .from('campanas')
    .insert(nuevaCampana)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ campana: data }, { status: 201 })
}
