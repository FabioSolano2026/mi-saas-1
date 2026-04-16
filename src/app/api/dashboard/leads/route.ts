/**
 * GET /api/dashboard/leads?campana_id=UUID&columna=xxx&page=1
 *
 * Leads del socio autenticado, opcionalmente filtrados por campaña y columna.
 * RLS garantiza que solo ve sus propios leads (socio_id = auth.uid()).
 */
import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'

const QuerySchema = z.object({
  campana_id: z.string().uuid().optional(),
  columna:    z.string().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  page_size:  z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 422 })

  const { campana_id, columna, page, page_size } = parsed.data
  const offset = (page - 1) * page_size

  let query = supabase
    .from('prospectos')
    .select(
      'prospecto_id, nombre, correo, telefono, columna_kanban, temperatura, origen, dias_sin_contacto, creado_en, campana_id',
      { count: 'exact' }
    )
    .eq('socio_id', user.id)
    .eq('visible_para_socio', true)
    .order('creado_en', { ascending: false })
    .range(offset, offset + page_size - 1)

  if (campana_id) query = query.eq('campana_id', campana_id)
  if (columna)    query = query.eq('columna_kanban', columna)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data ?? [], total: count ?? 0, page, page_size })
}
