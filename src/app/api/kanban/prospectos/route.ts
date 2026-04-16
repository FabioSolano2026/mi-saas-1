import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/kanban/prospectos
// Devuelve los prospectos del socio autenticado, agrupados por columna_kanban
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
    .from('prospectos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Agrupar por columna_kanban
  const columnas: Record<string, typeof data> = {}
  for (const p of data ?? []) {
    const col = p.columna_kanban ?? 'nuevo_prospecto'
    if (!columnas[col]) columnas[col] = []
    columnas[col].push(p)
  }

  return NextResponse.json({ columnas })
}
