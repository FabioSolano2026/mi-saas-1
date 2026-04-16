import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/disponibilidad?servicio_id=UUID&fecha=YYYY-MM-DD
// Devuelve slots disponibles para una fecha dada
export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const servicioId = searchParams.get('servicio_id')
  const fecha = searchParams.get('fecha')

  if (!servicioId || !fecha) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: servicio_id, fecha' },
      { status: 400 }
    )
  }

  // Validar formato fecha YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('disponibilidad')
    .select(`
      disponibilidad_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      duracion_minutos,
      estado,
      recurso_id,
      recursos ( nombre, tipo )
    `)
    .eq('servicio_id', servicioId)
    .eq('estado', 'disponible')
    .gte('fecha_hora_inicio', `${fecha}T00:00:00`)
    .lte('fecha_hora_inicio', `${fecha}T23:59:59`)
    .order('fecha_hora_inicio', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ slots: data })
}
