/**
 * GET  /api/auditoria/scripts-maestros  → Lista scripts del tenant
 * POST /api/auditoria/scripts-maestros  → Crea un nuevo script (desactiva el anterior)
 *
 * Solo auditores pueden gestionar scripts maestros.
 */
import { NextResponse } from 'next/server'
import { z }            from 'zod'
import { createClient } from '@/lib/supabase/server'

const SeccionSchema = z.object({
  clave:       z.string().min(2).max(100),
  descripcion: z.string().max(300).optional().default(''),
  peso:        z.number().min(1).max(100),
})

const ScriptSchema = z.object({
  nombre:    z.string().min(2).max(200),
  secciones: z.array(SeccionSchema).min(1).max(30),
  activo:    z.boolean().optional().default(true),
})

async function verificarAuditor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: socio } = await (supabase as any)
    .from('socios')
    .select('tenant_id, rol')
    .eq('usuario_id', user.id)
    .single()

  const s = socio as { tenant_id: string; rol: string } | null
  if (!s?.rol || s.rol === 'socio') return null
  return { supabase, socio: s }
}

export async function GET() {
  const supabase = await createClient()
  const ctx = await verificarAuditor(supabase)
  if (!ctx) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('scripts_maestros')
    .select('id, nombre, secciones, activo, creado_en')
    .order('creado_en', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const ctx = await verificarAuditor(supabase)
  if (!ctx) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  const parsed = ScriptSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 422 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  if (parsed.data.activo) {
    await db.from('scripts_maestros')
      .update({ activo: false })
      .eq('tenant_id', ctx.socio.tenant_id)
      .eq('activo', true)
  }

  const { data, error } = await db
    .from('scripts_maestros')
    .insert({ ...parsed.data, tenant_id: ctx.socio.tenant_id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
