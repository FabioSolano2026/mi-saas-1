/**
 * GET /api/agente/social-proof?campana_id=UUID
 *
 * Devuelve el contador de socios activos para el Momento 5A.
 *
 * Lógica de prioridad (MISION_AGENTE.md):
 *  1. COUNT(socios activos del tenant)
 *  2. Si < 5 → null (usar variante sin número)
 *  3. Si >= 100 → redondear al 10 más cercano hacia abajo
 *
 * Público (sin auth) — solo devuelve un número, nunca PII.
 */

import { NextResponse }  from 'next/server'
import { createClient }  from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const campana_id = searchParams.get('campana_id')

  if (!campana_id) {
    return NextResponse.json({ numero: null, variante_sin_numero: true }, { status: 400 })
  }

  try {
    // 1. Obtener tenant_id desde la campaña
    const { data: campana } = await supabaseAdmin
      .from('campanas')
      .select('tenant_id')
      .eq('campana_id', campana_id)
      .single()

    if (!campana) {
      return NextResponse.json({ numero: null, variante_sin_numero: true })
    }

    // 2. Contar socios activos del tenant
    const { count } = await supabaseAdmin
      .from('socios')
      .select('usuario_id', { count: 'exact', head: true })
      .eq('tenant_id', campana.tenant_id)
      .eq('estado', 'activo')

    const total = count ?? 0

    // 3. Aplicar reglas de presentación
    if (total < 5) {
      return NextResponse.json({ numero: null, variante_sin_numero: true })
    }

    if (total >= 100) {
      const redondeado = Math.floor(total / 10) * 10
      return NextResponse.json({ numero: redondeado, variante_sin_numero: false })
    }

    return NextResponse.json({ numero: total, variante_sin_numero: false })
  } catch {
    return NextResponse.json({ numero: null, variante_sin_numero: true })
  }
}
